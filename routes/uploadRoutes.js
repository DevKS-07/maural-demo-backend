require('dotenv').config();
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js')
const multer = require('multer')
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);



// Upload file using standard upload
async function uploadFile(file) {
  const { data, error } = await supabase.storage.from('file_storage').upload(file.originalname, file)
  if (error) {
    console.log(error)
  } else {
    console.log(data)
  }

 const stored = await prisma.file.create({
    data: {
      file_id: data.id,
      file_name: file.originalname,
      file_size: file.size,
      file_source: data.fullPath,
    }})
  
console.log('File metadata stored in database:', stored);

}



router.post('/', upload.any() ,(req, res) => {
  req.files.map(async file =>{
    await uploadFile(file);
  })

  res.status(200).json({
    message: 'Files uploaded locally with original extensions',
  });
});

module.exports = router;
