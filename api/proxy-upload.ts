// api/upload-file.ts - Fixed to handle proper filename from PDF data
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(500).json({ error: 'File upload failed' });
      }

      const file = files.file[0];
      if (!file || !file.filepath) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Validate file size
      const stats = fs.statSync(file.filepath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      if (fileSizeInMB > 10) { // Limit to 10MB
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }

      // Get Caspio credentials from environment variables
      const fileUploadUrl = process.env.CASPIO_FILE_UPLOAD_URL;
      const accessToken = process.env.CASPIO_ACCESS_TOKEN;

      if (!fileUploadUrl || !accessToken) {
        return res.status(500).json({ error: 'Missing Caspio configuration' });
      }

      try {
        // Extract filename from fields if provided (this comes from the frontend)
        const customFileName = fields.fileName ? fields.fileName[0] : null;
        
        // Use custom filename if provided, otherwise use original
        const finalFileName = customFileName || file.originalFilename || 'upload.pdf';
        
        console.log('Uploading file with name:', finalFileName);

        // Create form data
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(file.filepath);
        formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), finalFileName);

        // Upload to Caspio
        const response = await fetch(fileUploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': '*/*'
          },
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('File upload failed:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            error: errorText,
            fileName: finalFileName
          });
          return res.status(response.status).json({ 
            error: `File upload failed: ${errorText}`,
            details: { status: response.status, fileName: finalFileName }
          });
        }

        // Parse response
        let responseData;
        try {
          responseData = await response.json();
        } catch (e) {
          // If JSON parsing fails, create a simple success response
          responseData = { 
            success: true,
            fileUrl: `/${finalFileName}`,
            fileName: finalFileName 
          };
        }

        console.log('File uploaded successfully:', responseData);
        return res.status(200).json({ 
          success: true, 
          data: {
            ...responseData,
            fileUrl: `/${finalFileName}`,
            fileName: finalFileName
          }
        });
      } catch (error) {
        console.error('Error uploading to Caspio:', error);
        return res.status(500).json({
          error: 'Error uploading to Caspio',
          details: error instanceof Error ? error.message : 'Unknown upload error'
        });
      } finally {
        // Clean up temporary file
        try {
          if (file.filepath && fs.existsSync(file.filepath)) {
            fs.unlinkSync(file.filepath);
          }
        } catch (cleanupError) {
          console.warn('Could not clean up temporary file:', cleanupError);
        }
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
