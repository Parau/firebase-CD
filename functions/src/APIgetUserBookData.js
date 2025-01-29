const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.getUserBookData = functions.https.onCall(async (data, context) => {
  try {
    // Valida autenticação do usuário
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'O usuário deve estar autenticado para acessar esta função.'
      );
    }

    // Valida os parâmetros recebidos
    const uid = context.auth.uid; // ID do usuário autenticado
    const bookCode = data.bookCode;

    if (!bookCode || typeof bookCode !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'O código do livro (bookCode) é obrigatório e deve ser uma string.'
      );
    }

    // Acessa o Firestore para buscar os dados
    const userBookRef = admin
      .firestore()
      .collection('CDUsers')
      .doc(uid)
      .collection('BookData')
      .doc(bookCode);

    console.log('userBookRef:', userBookRef.path);
    const doc = await userBookRef.get();

    if (!doc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Nenhum documento encontrado com o código fornecido.'
      );
    }

    // Retorna os dados do Firestore
    return doc.data();
  } catch (error) {
    console.error('Erro ao obter dados do livro:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error; // Erros conhecidos são repassados
    }

    // Lança erro genérico em caso de problemas inesperados
    throw new functions.https.HttpsError(
      'internal',
      'Erro ao buscar os dados do livro.'
    );
  }
});
