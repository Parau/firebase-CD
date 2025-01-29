const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '../.env.local' });

// Inicializa o Firebase Admin SDK com uma chave privada
const serviceAccount = require('../accountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function getGoogleIdToken() {
  try {
    console.log('email do usuário:', process.env.USER_EMAIL);
    // Busca o usuário pelo email
    const user = await admin.auth().getUserByEmail(process.env.USER_EMAIL);
    console.log('Usuário encontrado:', user.uid);
    
    // Criar um token personalizado para o usuário
    const customToken = await admin.auth().createCustomToken(user.uid);
    
    // Define o caminho do arquivo token.json
    const tokenPath = path.join(__dirname, 'test', 'token.json');
    
    // Grava o token no arquivo
    const tokenData = { customToken };
    fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
    
    console.log('Token gerado e salvo em:', tokenPath);
    console.log('Custom Token:', customToken);
    console.log('UID do usuário:', user.uid);
    
    return customToken;
  } catch (error) {
    console.error('Error getting/saving token:', error);
    throw error;
  }
}

getGoogleIdToken();
