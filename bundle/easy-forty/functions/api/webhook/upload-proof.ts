import { sendMessage } from '../../lib/telnyx';

// Optional endpoint if using direct MMS upload to R2 in future. Not used now.
export const onRequestPost: PagesFunction = async (ctx) => {
  return new Response('disabled', { status: 200 });
};
