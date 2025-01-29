const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.getUserConquistas = functions.https.onCall(async (data, context) => {
  try {

    console.log('========= FUNCTION CALL START =========');
    const receivedData = data || 'Parau empty data';
    console.log('Data received:', data ? 'YES' : 'NO');
    console.log('Debug info:', receivedData);
    console.log('========= FUNCTION CALL END =========');

    // Valida autenticação do usuário
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'O usuário deve estar autenticado para acessar esta função.'
      );
    }

    // Valida os parâmetros recebidos
    const uid = context.auth.uid; // ID do usuário autenticado

    // Acessa o Firestore para buscar os dados
    const userDataRef = admin
      .firestore()
      .collection('CDUsers')
      .doc(uid)
      .collection('Conquistas');

    console.log('userDataRef:', userDataRef.path);
    const collectionSnapshot = await userDataRef.get();

    if (collectionSnapshot.empty) {
      throw new functions.https.HttpsError(
        'not-found (collectionSnapshot.empty)',
        'Nenhuma collection encontrada neste UId.'
      );
    }

    // Retorna os dados do Firestore
    const conquistas = [];
    collectionSnapshot.forEach(doc => {
      conquistas.push(doc.data());
    });

    return { conquistas };
  } catch (error) {
    console.error('Erro ao obter dados das conquistas:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error; // Erros conhecidos são repassados
    }

    // Lança erro genérico em caso de problemas inesperados
    throw new functions.https.HttpsError(
      'internal',
      'Erro ao buscar os dados das conquistas.'
    );
  }
});
