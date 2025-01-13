import { NextApiRequest, NextApiResponse } from 'next';
import FormData from 'form-data';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const fileUploadUrl = process.env.VITE_CASPIO_FILE_UPLOAD_URL;
  const token = process.env.VITE_CASPIO_ACCESS_TOKEN;

  if (!fileUploadUrl || !token) {
    return res.status(500).json({ error: 'Caspio configuration missing' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const formData = new FormData();

    // Assuming the file comes in the request body as a raw buffer
    if (req.body) {
      formData.append('File', req.body, 'uploaded-file.pdf'); // Replace with the actual filename if needed
    } else {
      return res.status(400).json({ error: 'No file provided' });
    }

    const response = await fetch(fileUploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...formData.getHeaders(), // Include multipart headers
      },
      body: formData,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy upload error:', error);
    res.status(500).json({ error: 'Failed to upload file to Caspio' });
  }
}
