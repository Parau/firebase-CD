const functions = require('firebase-functions');
const admin = require('firebase-admin');
const xlsx = require('xlsx');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Verifica se o Firebase Admin já foi inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.updateUserClaimsFromExcel = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name;
  const fileName = path.basename(filePath);

  const expectedFileName = 'lista_de_usuarios_com_livros.xlsx';
  if (fileName !== expectedFileName) {
    console.log(`Arquivo ignorado: ${fileName}. Esperado: ${expectedFileName}`);
    return null;
  }

  const tempFilePath = path.join(os.tmpdir(), fileName);
  const bucket = admin.storage().bucket(object.bucket);

  // Baixar o arquivo Excel
  await bucket.file(filePath).download({ destination: tempFilePath });
  console.log(`Arquivo Excel ${fileName} baixado para ${tempFilePath}`);

  const workbook = xlsx.readFile(tempFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = xlsx.utils.sheet_to_json(worksheet);

  // Processa cada linha da planilha
  for (const row of jsonData) {
    const uid = row.uid;
    const bookCode = row.bookCode; // Agora é um único código de livro por linha
    const expiryDate = row.expiryDate; // Data de validade do acesso

    try {
      console.log(`Processando usuário com UID: ${uid}`);
      const user = await admin.auth().getUser(uid);
      const existingClaims = user.customClaims || {};
      const booksClaim = existingClaims.books || [];
    
      const bookIndexClaims = booksClaim.findIndex(book => book.code === bookCode);
      
      if (bookIndexClaims === -1) {
        booksClaim.push({ code: bookCode, expiryDate });
        console.log(`Livro ${bookCode} adicionado nas custom claims do usuário ${uid}.`);
      } else {
        booksClaim[bookIndexClaims].expiryDate = expiryDate;
        console.log(`A data de validade do livro ${bookCode} foi atualizada para ${expiryDate} nas custom claims do usuário ${uid}.`);
      }
    
      await admin.auth().setCustomUserClaims(uid, { ...existingClaims, books: booksClaim });
      
      const userRef = admin.firestore().collection('CDUsers').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.exists ? userDoc.data() : {};
      console.log(`Dados do Firestore para ${uid}:`, userData);
    
      let existingBookCodes = userData.bookCodes || [];
      const bookIndex = existingBookCodes.findIndex(book => book.code === bookCode);
      
      if (bookIndex === -1) {
        existingBookCodes.push({ code: bookCode, expiryDate });
        console.log(`Livro ${bookCode} adicionado ao Firestore para o usuário ${uid}.`);
      } else {
        existingBookCodes[bookIndex].expiryDate = expiryDate;
        console.log(`A data de validade do livro ${bookCode} foi atualizada para ${expiryDate} no Firestore.`);
      }
    
      await userRef.set({
        uid: uid,
        bookCodes: existingBookCodes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
    } catch (error) {
      console.error(`Erro ao processar o usuário ${uid}:`, error.message);
      console.error(error.stack);
    }
   
  }

  // Remover arquivo temporário
  fs.unlinkSync(tempFilePath);
  console.log('Arquivo temporário removido.');
});
