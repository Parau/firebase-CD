//updateBooksAccess.js
const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const xlsx = require('xlsx');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.updateUserClaimsFromExcel = functions.storage.onObjectFinalized({
  // Configure memory and timeout as needed
  memory: '256MiB',
  timeoutSeconds: 540, // 9 minutes
  // Filter for specific file
  eventFilters: {
    name: ['lista_de_usuarios_com_livros.xlsx']
  }
}, async (event) => {
  try {
    const filePath = event.data.name;
    const fileName = path.basename(filePath);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    
    console.log(`Iniciando processamento do arquivo: ${fileName}`);
    
    // Get bucket reference
    const bucket = admin.storage().bucket(event.data.bucket);

    // Download Excel file
    try {
      await bucket.file(filePath).download({ destination: tempFilePath });
      console.log(`Arquivo Excel ${fileName} baixado para ${tempFilePath}`);
    } catch (downloadError) {
      console.error('Erro ao baixar arquivo:', downloadError);
      throw new Error(`Falha ao baixar arquivo: ${downloadError.message}`);
    }

    // Read and process Excel file
    let workbook;
    try {
      workbook = xlsx.readFile(tempFilePath);
    } catch (excelError) {
      console.error('Erro ao ler arquivo Excel:', excelError);
      throw new Error(`Falha ao ler arquivo Excel: ${excelError.message}`);
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    console.log(`Processando ${jsonData.length} linhas da planilha`);

    // Process each row
    for (const row of jsonData) {
      const { uid, bookCode, expiryDate, modulos } = row;

      if (!uid || !bookCode) {
        console.warn('Linha ignorada - uid ou bookCode faltando:', row);
        continue;
      }

      try {
        console.log(`Processando usuário com UID: ${uid}`);
        
        // Get user and current claims
        const user = await admin.auth().getUser(uid);
        const existingClaims = user.customClaims || {};
        const bookExpiryDates = existingClaims.bookExpiryDates || {};

        // Update book expiry date
        bookExpiryDates[bookCode] = expiryDate;
        console.log(`Data de validade para o livro ${bookCode} definida como ${expiryDate} nas custom claims do usuário ${uid}`);

        // Update custom claims
        await admin.auth().setCustomUserClaims(uid, {
          ...existingClaims,
          bookExpiryDates
        });

        // Update Firestore user document
        const userRef = admin.firestore().collection('CDUsers').doc(uid);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : {};

        // Update Firestore book expiry dates
        const firestoreBookExpiryDates = userData.bookExpiryDates || {};
        firestoreBookExpiryDates[bookCode] = expiryDate;

        // Update main user document
        await userRef.set({
          uid: uid,
          bookExpiryDates: firestoreBookExpiryDates,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update book-specific data
        if (modulos) {
          const userBookDataRef = admin
            .firestore()
            .collection('CDUsers')
            .doc(uid)
            .collection('BookData')
            .doc(bookCode);

          const bookData = {
            modulos: modulos.split(',').map(m => m.trim()),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };

          await userBookDataRef.set(bookData, { merge: true });
          console.log(`Dados do livro ${bookCode} atualizados para o usuário ${uid}`);
        }

      } catch (userError) {
        console.error(`Erro ao processar o usuário ${uid}:`, userError.message);
        console.error(userError.stack);
        // Continue processing other users even if one fails
      }
    }

    // Cleanup: Remove temporary file
    try {
      fs.unlinkSync(tempFilePath);
      console.log('Arquivo temporário removido com sucesso');
    } catch (cleanupError) {
      console.warn('Erro ao remover arquivo temporário:', cleanupError);
    }

    console.log('Processamento concluído com sucesso');
    return { success: true, processedRows: jsonData.length };

  } catch (error) {
    console.error('Erro fatal durante o processamento:', error);
    throw error; // Rethrow to mark function as failed
  }
});