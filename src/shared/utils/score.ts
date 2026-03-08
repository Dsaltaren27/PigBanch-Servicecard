export function generateScore(): number {
  return Math.floor(Math.random() * 101); // 0 – 100
}

export function calculateCreditLimit(score: number): number {
  return 100 + (score / 100) * (10_000_000 - 100);
}