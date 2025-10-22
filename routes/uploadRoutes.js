require('dotenv').config();
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js')
const multer = require('multer')

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);


async function getmock() {
const { data: mock_data, error } = await supabase.from('mock_data').select('*')
console.log(mock_data);
}



// Upload file using standard upload
async function uploadFile(file) {
  const { data, error } = await supabase.storage.from('file_storage').upload('/', file)
  if (error) {
    console.log('L')
  } else {
    console.log('W')
  }
}



router.post('/', upload.any() ,(req, res) => {
  req.files.map(async file =>{
     await uploadFile(file)
  })

  res.status(200).json({
    message: 'Files uploaded locally with original extensions',
  });
});

module.exports = router;
