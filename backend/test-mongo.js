// // backend/test-mongo.js
const mongoose = require('mongoose');
require('dotenv').config();

const testConnection = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    console.log('URI:', process.env.MONGODB_URI.replace(/:[^:]*@/, ':****@'));
    
    // ✅ UPDATED - Removed deprecated options
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ MongoDB Connected Successfully!');
    console.log('📍 Database:', mongoose.connection.name);
    console.log('📍 Host:', mongoose.connection.host);
    
    const TestSchema = new mongoose.Schema({
      name: String,
      createdAt: { type: Date, default: Date.now }
    });
    
    const Test = mongoose.model('Test', TestSchema);
    
    const testDoc = await Test.create({
      name: 'Connection Test'
    });
    
    console.log('✅ Test document created:', testDoc);
    
    await Test.deleteOne({ _id: testDoc._id });
    console.log('✅ Test document deleted');
    
    await mongoose.connection.close();
    console.log('✅ Connection closed successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB Connection Error:');
    console.error('Error Message:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.error('\n🔑 Authentication Error - Check your username and password');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('\n🌐 Network Error - Check your internet connection or MongoDB cluster URL');
    } else if (error.message.includes('IP')) {
      console.error('\n🛡️ IP Whitelist Error - Add your IP to MongoDB Atlas Network Access');
    }
    
    process.exit(1);
  }
};

testConnection();

// const mongoose = require('mongoose');
// require('dotenv').config();

// async function testConnection() {
//   try {
//     const conn = await mongoose.connect(process.env.MONGODB_URI);
//     console.log('MongoDB connected successfully');
//     console.log('Host:', conn.connection.host);
//     process.exit(0);
//   } catch (error) {
//     console.error('MongoDB connection failed');
//     console.error(error.message);
//     process.exit(1);
//   }
// }

// testConnection();