const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.getUserConquistas = onCall(async (request) => {
  try {
    console.log('request:', request);
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '...');
    }
    const context = request.auth;

    // Valida autenticação do usuário
    if (!context) {
      throw new HttpsError(
        'unauthenticated',
        'O usuário deve estar autenticado para acessar esta função.'
      );
    }

    // Valida os parâmetros recebidos
    const uid = context.uid; // ID do usuário autenticado

    // Acessa o Firestore para buscar os dados
    const userDataRef = admin
      .firestore()
      .collection('CDUsers')
      .doc(uid)
      .collection('Conquistas');

    console.log('userDataRef:', userDataRef.path);
    const collectionSnapshot = await userDataRef.get();

    if (collectionSnapshot.empty) {
      throw new HttpsError(
        'not-found',
        'Nenhuma collection encontrada neste UId.'
      );
    }

    // Retorna os dados do Firestore
    const conquistas = collectionSnapshot.docs.map(doc => ({
      id: doc.id,  // Incluir o ID do documento
      ...doc.data()
    }));

    return { conquistas };
  } catch (error) {
    console.error('Erro ao obter dados das conquistas:', error);

    if (error instanceof HttpsError) {
      throw error; // Erros conhecidos são repassados
    }

    // Lança erro genérico em caso de problemas inesperados
    throw new HttpsError(
      'internal',
      'Erro ao buscar os dados das conquistas.'
    );
  }
});