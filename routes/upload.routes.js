
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js')
const multer = require('multer')
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ 
  connectionString: process.env.DATABASE_URL 
});
const prisma = new PrismaClient({ adapter });

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);



// Upload file using standard upload
async function uploadFile(file) {
  const safeName = encodeURIComponent(file.originalname);

  const { data, error } = await supabase.storage
    .from('file_storage')
    .upload(`uploads/${safeName}`, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    throw error;
  }

  console.log("File uploaded to Supabase Storage:", data);

  // Return the Supabase upload result so caller can store metadata
  return data;
}


router.post('/', upload.array("files"), async (req, res) => {
  try {
    let categories = req.body.categories;
    if (!Array.isArray(categories)) categories = [categories];

    const results = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const category = categories[i] || "uncategorized";

      // Upload to Supabase
      const supabaseData = await uploadFile(file);
      const safeName = encodeURIComponent(file.originalname);


      // Store metadata in Prisma
      const stored = await prisma.file.create({
        data: {
          file_id: supabaseData.id,
          file_name: safeName,
          file_size: file.size,
          file_source: supabaseData.fullPath,
        },
      });

      results.push(stored);
    }

    res.status(200).json({
      message: "Files uploaded successfully",
      files: results,
    });

  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});



module.exports = router;
