/*-------------
Tive geração de erro no deployment em 27/01/2025 então entendi que tem que usar a 2a geração das cloud functions que não tem mais o onfinalize.
-------------------*/ 



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
    const modulos = row.modulos; // Módulos do livro que o usuário tem acesso
    console.log(`Processando linha planilha format json: ${JSON.stringify(row)}`);

    try {
      console.log(`Processando usuário com UID: ${uid}`);
      const user = await admin.auth().getUser(uid);
      const existingClaims = user.customClaims || {};
      const bookExpiryDates = existingClaims.bookExpiryDates || {};
    
      // Atualiza ou adiciona a data de validade do livro no campo bookExpiryDates
      bookExpiryDates[bookCode] = expiryDate;
      console.log(`Data de validade para o livro ${bookCode} definida como ${expiryDate} nas custom claims do usuário ${uid}.`);
    
      // Define as custom claims com a nova estrutura
      await admin.auth().setCustomUserClaims(uid, { ...existingClaims, bookExpiryDates });
      
      const userRef = admin.firestore().collection('CDUsers').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.exists ? userDoc.data() : {};
      console.log(`Dados do Firestore para ${uid}:`, userData);
    
      // Firestore: Use the same `bookExpiryDates` format for Firestore
      const firestoreBookExpiryDates = userData.bookExpiryDates || {};
      firestoreBookExpiryDates[bookCode] = expiryDate;
      console.log(`Data de validade para o livro ${bookCode} definida como ${expiryDate} no Firestore para o usuário ${uid}.`);
    
      // Atualizar Firestore com o novo formato
      await userRef.set({
        uid: uid,
        bookExpiryDates: firestoreBookExpiryDates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Agora com os dados específicos deste livro
      await userRef.set({
        uid: uid,
        bookExpiryDates: firestoreBookExpiryDates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      // Atualizar Firestore com o novo formato
      const userBookDataRef = admin
        .firestore()
        .collection('CDUsers')
        .doc(uid)
        .collection('BookData')
        .doc(bookCode);
      
      const bookData = {
        modulos: modulos.split(',')
      }
      
      await userBookDataRef.set(bookData, { merge: true })
        .then(() => {
          console.log('Documento GPT atualizado com sucesso!');
        })
        .catch((error) => {
          console.error('Erro ao atualizar o documento GPT:', error);
      });      

      
    } catch (error) {
      console.error(`Erro ao processar o usuário ${uid}:`, error.message);
      console.error(error.stack);
    }
  }

  // Remover arquivo temporário
  fs.unlinkSync(tempFilePath);
  console.log('Arquivo temporário removido.');
});
