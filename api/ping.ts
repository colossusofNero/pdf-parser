
export const config = { runtime: 'nodejs' };
export default async function handler(_req: any, res: any) {
  return res.status(200).json({ ok: true, node: process.version });
}
