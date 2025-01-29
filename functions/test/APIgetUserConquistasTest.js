/* ---------------------------
Como usar:
* Ativar o servidor local do firebase
yarn serve

* obter node getGoogleIdToken.js (ele grava em um arquivo token.json usado por esta função de teste)
node getGoogleIdToken.js

* rodar esta função de teste
node test/APIgetUserConquistasTest.js

--------------------------- */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithCustomToken } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { connectFunctionsEmulator } = require('firebase/functions');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '../.env.local' });
// Imprimir o caminho completo que está sendo usado
console.log('Caminho do .env sendo procurado:', require('path').resolve('../../.env.local'));


// Configuração do Firebase Client
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID
};

console.log('Iniciando teste com projeto:', process.env.FIREBASE_PROJECT_ID);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);
// Conecta ao emulador local
connectFunctionsEmulator(functions, 'localhost', 5001);

async function testGetUserConquistas() {
  try {
    // Lê o token do arquivo
    const tokenPath = path.join(__dirname, 'token.json');
    console.log('Lendo token do arquivo:', tokenPath);
    
    if (!fs.existsSync(tokenPath)) {
      throw new Error('Arquivo token.json não encontrado. Por favor, crie o arquivo com seu token.');
    }
    const { customToken } = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    
    if (!customToken) {
      throw new Error('Token não encontrado no arquivo token.json');
    }
    
    console.log('Custom token obtido, realizando autenticação...');
    
    // Troca o Custom Token por um ID Token
    const userCredential = await signInWithCustomToken(auth, customToken);
    console.log('Usuário autenticado, UID:', userCredential.user.uid);
    
    // Chama a função usando o SDK do Firebase Functions
    const getUserConquistas = httpsCallable(functions, 'getUserConquistas');
    console.log('Chamando a função getUserConquistas...');
    const result = await getUserConquistas();
    console.log('Terminou o await da função getUserConquistas...');
    
    console.log('Response data:', result.data);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.details) {
      console.error('Error details:', error.details);
    }
  }
}

testGetUserConquistas();
