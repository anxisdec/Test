export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ChatMode = 'practice' | 'live' | 'offline';
export const offTopicReply = 'I’m here for life science study: zoology, botany, environmental science, and related revision. Try asking how an animal adapts, why a plant grows a certain way, or how an ecosystem works.';

export function validateMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 9 || input.length % 2 === 0) throw new Error('Send a question between 1 and 1,200 characters.');
  return input.map((item, index) => {
    const role = index % 2 === 0 ? 'user' : 'assistant';
    const text = typeof item?.content === 'string' ? item.content.trim() : '';
    if (item?.role !== role || !text || text.length > (role === 'user' ? 1200 : 2400)) throw new Error('One of the messages is empty or too long. Try a shorter question.');
    return { role, content: text };
  });
}

const practiceTopics = [
  { words: /photosynth|chloropl|chlorophyll|calvin cycle|stomata/, answer: 'Photosynthesis is how plants store light energy as chemical energy. Chlorophyll in chloroplasts absorbs light. The light reactions split water (releasing oxygen) and make ATP and NADPH. The Calvin cycle uses that energy to build sugars from carbon dioxide.\n\nQuick check: Which raw material supplies the carbon in the sugar?' },
  { words: /fern|fiddlehead|spores?|frond/, answer: 'A young fern frond is curled into a fiddlehead. This arrangement, called circinate vernation, keeps the growing tip and delicate leaflets tucked inside. The frond gradually uncurls as its tissues grow.\n\nOn a mature fertile frond, look for clusters called sori. Each sorus contains structures that make spores; it isn’t one large spore.' },
  { words: /monarch|butterfl|migration|migrate/, answer: 'Eastern North American monarchs find their way south using the Sun as a compass and an internal clock to adjust for its movement. One long-lived generation overwinters in Mexico, but several generations take turns repopulating the north.\n\nThink it through: Why does the whole migration need both nectar flowers and milkweed?' },
  { words: /octopus|octopod|cephalopod|octopuses/, answer: 'An octopus has both a central brain and large groups of neurons in its arms. The arms process a lot of touch and chemical information locally, while the brain helps coordinate larger goals. So “nine brains” is a catchy shorthand, not nine separate minds.\n\nWhat might be an advantage of letting an arm respond to touch without waiting for the central brain?' },
  { words: /wetland|marsh|flood|mangrove|swamp/, answer: 'Wetlands act a little like sponges. Vegetation and shallow channels slow the water down, while some wetlands spread and temporarily store floodwater. That can lower the peak flow downstream. The effect depends on the wetland’s size, location, and whether it’s already saturated.\n\nWetlands also give young fish shelter and can trap sediment. Can you name a wetland near your area?' },
  { words: /food chain|food web|trophic|ecosystem|biodiversity|climate|energy flow/, answer: 'In a food web, arrows point from the food to the organism getting energy from it. For example: grass → grasshopper → frog. Much of the energy is used in metabolism or released as heat at each step, so less is available up the web.\n\nCan you add a second path from the grass to a predator in the same ecosystem?' },
  { words: /animal|zoology|vertebrat|invertebrat|adaptation/, answer: 'An adaptation is an inherited feature that can help an organism survive or reproduce in its environment. Think of the webbed feet of a duck: extra surface area helps push against water. An individual doesn’t grow an adaptation just because it needs one; helpful inherited traits can become more common over generations.\n\nTry choosing an animal and describing how one of its features fits where it lives.' },
];

export function practiceReply(messages: ChatMessage[]) {
  const question = messages[messages.length - 1].content.toLowerCase();
  const match = practiceTopics.find(item => item.words.test(question));
  if (match) return match.answer;
  if (/\b(hi|hey|hello|namaste)\b/.test(question) && question.length < 20) return 'Namaste! Pick a life science topic: how plants use light, how monarchs get to Mexico, or what wetlands do during a flood.';
  if (/\b(quiz|test me|example|explain again|explain more|simpler)\b/.test(question)) {
    const earlier = [...messages].reverse().find(message => message.role === 'user' && practiceTopics.some(topic => topic.words.test(message.content.toLowerCase())));
    const topic = earlier && practiceTopics.find(item => item.words.test(earlier.content.toLowerCase()));
    if (topic) return `Let’s practise. Try saying the main idea in one sentence, then answer this without looking back:\n\n${topic.answer.split('\n\n').at(-1)}`;
  }
  if (/\b(cook|song|recipe|weather|stock|football|cricket|game|politic|hacking|code|password)\b/.test(question)) return offTopicReply;
  return 'In practice mode, I can help with monarch migration, octopus intelligence, ferns, photosynthesis, wetlands, adaptations, and food webs. Choose one of those topics to try it out. Live AI covers more study topics once it’s connected.';
}
