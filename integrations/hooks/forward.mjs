import { normalize } from './normalize.mjs';
import { send } from '../bridge/send.mjs';

// An absent companion, bad input, or transport failure never controls the coding agent.
try {
  let text = '';
  for await (const chunk of process.stdin) {
    text += chunk.toString();
    if (Buffer.byteLength(text) > 262144) {
      process.stdin.destroy();
      text = '';
      break;
    }
  }
  if (text) {
    const packet = normalize(process.argv[2], JSON.parse(text));
    if (packet) await send(packet);
  }
} catch {
  /* Exit zero, with no stdout or permission/continuation decision. */
}
