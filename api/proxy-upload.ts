// api/proxy-upload.ts
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Get environment variables (with VITE_ prefix for server-side)
  const fileUploadUrl = process.env.VITE_CASPIO_FILE_UPLOAD_URL;
  const token = process.env.VITE_CASPIO_ACCESS_TOKEN;

  console.log('Proxy upload - Environment check:', {
    hasFileUploadUrl: !!fileUploadUrl,
    hasToken: !!token,
    tokenLength: token?.length || 0
  });

  if (!fileUploadUrl || !token) {
    console.error('Missing Caspio configuration:', {
      fileUploadUrl: !!fileUploadUrl,
      token: !!token
    });
    return res.status(500).json({ 
      error: 'Caspio configuration missing',
      details: 'Missing file upload URL or access token'
    });
  }

  try {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    
    // Handle both 'File' and 'file' field names
    const uploadedFile = files.File?.[0] || files.file?.[0];
    
    if (!uploadedFile || !uploadedFile.filepath) {
      return res.status(400).json({ 
        error: 'No file provided',
        receivedFields: Object.keys(fields),
        receivedFiles: Object.keys(files)
      });
    }

    console.log('File received:', {
      originalFilename: uploadedFile.originalFilename,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype
    });

    // Create FormData for Caspio upload
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);
    const blob = new Blob([fileBuffer], { type: uploadedFile.mimetype || 'application/pdf' });
    
    formData.append('file', blob, uploadedFile.originalFilename || 'upload.pdf');

    console.log('Uploading to Caspio:', fileUploadUrl);

    // Upload to Caspio
    const response = await fetch(fileUploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: formData
    });

    // Clean up temporary file
    try {
      fs.unlinkSync(uploadedFile.filepath);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp file:', cleanupError);
    }

    console.log('Caspio response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Caspio upload failed:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        error: errorText
      });
      
      return res.status(response.status).json({
        error: 'Caspio upload failed',
        details: errorText,
        status: response.status
      });
    }

    // Parse Caspio response
    let responseData;
    try {
      responseData = await response.json();
      console.log('Caspio upload successful:', responseData);
    } catch (parseError) {
      console.log('Could not parse Caspio response as JSON, assuming success');
      responseData = { 
        fileUrl: uploadedFile.originalFilename,
        success: true
      };
    }

    return res.status(200).json({
      success: true,
      fileUrl: responseData.fileUrl || responseData.data?.fileUrl || uploadedFile.originalFilename,
      data: responseData
    });

  } catch (error) {
    console.error('Proxy upload error:', error);
    return res.status(500).json({
      error: 'Failed to upload file to Caspio',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
