/**
 * Chat transcript: rows of | speaker | message |. "You" rows are the user;
 * "Steps" rows are progress lines; any other speaker is the agent.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    const [speaker, message] = row.children;
    speaker?.classList.add('chat-speaker');
    message?.classList.add('chat-message');
    const who = speaker?.textContent.trim().toLowerCase() || '';
    if (who === 'you') row.classList.add('chat-you');
    else if (who === 'steps') row.classList.add('chat-steps');
    else row.classList.add('chat-agent');
  });
}
