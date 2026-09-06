export function sendGroupPoll(
  chatId: number,
  question: string,
  options: string[],
  correctOptionId: number,
  explanation?: string,
): Promise<any>;

export default function handler(req: any, res: any): Promise<any>;
