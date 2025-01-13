import { NextApiRequest, NextApiResponse } from 'next';

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
    const response = await fetch(fileUploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: req.body, // Pass the request body directly
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy upload error:', error);
    res.status(500).json({ error: 'Failed to upload file to Caspio' });
  }
}
