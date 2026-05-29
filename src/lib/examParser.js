const ANSWER_KEY = [
  ['event that is usually staged by a local community', 'c'],
  ['festival is famous for colorful masks', 'b'],
  ['sinulog festival is celebrated in honor', 'a'],
  ['flower festival in baguio city', 'a'],
  ['aklan is known for people wearing black face paint', 'a'],
  ['houses decorated with colorful rice wafers', 'b'],
  ['davao city to give thanks', 'a'],
  ['what do festivals show about filipino culture', 'b'],
  ['angono rizal is known for its giant colorful puppets', 'b'],
  ['moriones festival is celebrated during which season', 'c'],
  ['main attraction of the higantes festival', 'a'],
  ['giant lantern festival is celebrated in which province', 'a'],
  ['taong putik festival', 'b'],
  ['feast of the black nazarene', 'b'],
  ['why are festivals important to a community', 'b'],
  ['premiere national art fair', 'b'],
  ['what is a live performance', 'b'],
  ['example of a live performance', 'a'],
  ['dramatic form of musical theater', 'b'],
  ['group of musicians who perform while marching', 'a'],
  ['basic health right', 'b'],
  ['helping people enjoy their basic health rights', 'b'],
  ['why are basic health rights important', 'a'],
  ['right to good health mean', 'b'],
  ['who helps ensure that people enjoy their right to good health', 'a'],
  ['law protects the rights of consumers', 'b'],
  ['right to redress allow', 'a'],
  ['health diet or fitness that becomes popular quickly', 'b'],
  ['solidarity in consumer responsibility', 'a'],
  ['consumer education important', 'a']
];

const MATCHING_KEY = [
  ['toy that broke on the first day', 'Right to Redress', ['redress']],
  ['wants to know the ingredients', 'Right to Information', ['information']],
  ['different brands of soap', 'Right to Choose', ['choose', 'choice']],
  ['reports a problem with his electricity bill', 'Right to Representation', ['representation']],
  ['teaches students how to check product labels', 'Right to Consumer Education', ['consumer education', 'education']],
  ['clean water and nutritious food', 'Right to Basic Needs', ['basic needs']],
  ['toy that has sharp edges', 'Right to Safety', ['safety']],
  ['learn about his rights as a buyer', 'Right to Consumer Education', ['consumer education', 'education']],
  ['displays the prices and product information', 'Right to Information', ['information']],
  ['gets a refund when the blender', 'Right to Redress', ['redress']],
  ['shoes he bought do not fit properly', 'Right to Redress', ['redress']],
  ['seminar to learn how to compare prices', 'Right to Consumer Education', ['consumer education', 'education']]
];

const LIVE_PERFORMANCE_ANSWERS = [
  'concert',
  'live concert',
  'street dance',
  'dance recital',
  'theater play',
  'musical',
  'opera',
  'ballet',
  'marching band',
  'choral performance',
  'stage play'
];

const CONSUMER_SKILL_ANSWERS = [
  'critical thinking',
  'decision making',
  'problem solving',
  'assertiveness',
  'budgeting',
  'reading labels',
  'comparing products',
  'wise buying'
];

const CONSUMER_RIGHT_CHOICES = {
  a: 'Right to Redress',
  b: 'Right to Information',
  c: 'Right to Choose',
  d: 'Right to Representation',
  e: 'Right to Consumer Education',
  f: 'Right to Basic Needs',
  g: 'Right to Safety'
};

const LIVE_PERFORMANCE_MC = [
  { correct: 'Concert', distractors: ['Watching a movie online', 'Reading a poster', 'Looking at a painting'] },
  { correct: 'Street dance', distractors: ['Printed brochure', 'Recorded cartoon', 'Silent reading'] },
  { correct: 'Theater play', distractors: ['Notebook drawing', 'Product label', 'Text message'] },
  { correct: 'Ballet', distractors: ['Recipe book', 'Photo album', 'Online game'] },
  { correct: 'Marching band', distractors: ['Library card', 'Food package', 'Wall calendar'] }
];

const CONSUMER_SKILL_MC = [
  { correct: 'Critical thinking', distractors: ['Impulse buying', 'Ignoring labels', 'Wasting money'] },
  { correct: 'Decision making', distractors: ['Guessing randomly', 'Following every advertisement', 'Skipping comparison'] },
  { correct: 'Comparing products', distractors: ['Buying without checking', 'Throwing receipts away', 'Ignoring prices'] }
];

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\t+/g, ' ')
    .replace(/_{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function repairChoiceSpacing(line) {
  return line
    .replace(/([?:)])([abc])\.\s*/g, '$1 $2. ')
    .replace(/([a-zA-Zñ])([abc])\.\s*/g, '$1 $2. ')
    .replace(/\s+/g, ' ')
    .trim();
}

function prepareLines(text) {
  const prepared = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = repairChoiceSpacing(cleanLine(rawLine));
    if (!line) continue;

    const splitIndex = line.search(/\s+a\.\s+/i);
    if (splitIndex > 0) {
      const prompt = cleanLine(line.slice(0, splitIndex));
      const choices = cleanLine(line.slice(splitIndex));
      if (prompt) prepared.push(prompt);
      if (choices) prepared.push(choices);
      continue;
    }

    prepared.push(line);
  }
  return prepared;
}

function answerForPrompt(prompt) {
  const normalizedPrompt = normalize(prompt);
  const match = ANSWER_KEY.find(([needle]) => normalizedPrompt.includes(normalize(needle)));
  return match?.[1] ?? '';
}

function matchingAnswerForPrompt(prompt) {
  const normalizedPrompt = normalize(prompt);
  const match = MATCHING_KEY.find(([needle]) => normalizedPrompt.includes(normalize(needle)));
  return {
    correctAnswer: match?.[1] ?? '',
    acceptedAnswers: match?.[2] ?? []
  };
}

function keyForChoice(choices, value) {
  const normalizedValue = normalize(value);
  return Object.entries(choices).find(([, choice]) => normalize(choice) === normalizedValue)?.[0] ?? '';
}

function makeFourChoiceQuestion({ id, section, prompt, correct, distractors }) {
  return {
    id,
    section,
    type: 'multiple-choice',
    prompt,
    choices: {
      a: correct,
      b: distractors[0],
      c: distractors[1],
      d: distractors[2]
    },
    correctAnswer: 'a',
    acceptedAnswers: [],
    points: 1
  };
}

function extractChoices(lines) {
  const joined = repairChoiceSpacing(lines.join(' '));
  const matches = [...joined.matchAll(/(?:^|\s)([abc])\.\s*(.*?)(?=\s+[abc]\.\s*|$)/gi)];
  const choices = {};

  if (matches.length > 0 && matches[0][1].toLowerCase() !== 'a') {
    const leadingText = cleanLine(joined.slice(0, matches[0].index));
    if (leadingText) choices.a = leadingText;
  }

  if (matches.length > 0) {
    for (const match of matches) {
      choices[match[1].toLowerCase()] = cleanLine(match[2]);
    }
    return choices;
  }

  return {};
}

function lineHasChoice(line) {
  return /(?:^|\s)[abc]\.\s+/i.test(repairChoiceSpacing(line));
}

function isDirective(line) {
  return /^(direction|i\. direction|ii\.|read each situation|enumeration|name:|right to )/i.test(line);
}

function isSection(line) {
  return /^music\s*&\s*arts$/i.test(line) || /^p\.?e\s*&\s*health$/i.test(line);
}

function makeId(index) {
  return `q${String(index).padStart(2, '0')}`;
}

export function parseExamText(text) {
  const lines = prepareLines(text);

  const title = lines.find((line) => /quarter exam/i.test(line)) ?? 'Imported Exam';
  const questions = [];
  let section = '';
  let mode = 'multiple-choice';

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (isSection(line)) {
      section = line.toUpperCase().includes('HEALTH') ? 'P.E & HEALTH' : 'Music & Arts';
      mode = 'multiple-choice';
      continue;
    }

    if (/enumerate at least 5 types of live performances/i.test(line)) {
      mode = 'live-enumeration';
      for (const item of LIVE_PERFORMANCE_MC) {
        questions.push(makeFourChoiceQuestion({
          id: makeId(questions.length + 1),
          section,
          prompt: 'Which of the following is a type of live performance?',
          correct: item.correct,
          distractors: item.distractors
        }));
      }
      continue;
    }

    if (/read each situation carefully/i.test(line)) {
      mode = 'matching';
      continue;
    }

    if (/list down the three skills/i.test(line)) {
      mode = 'consumer-skills';
      for (const item of CONSUMER_SKILL_MC) {
        questions.push(makeFourChoiceQuestion({
          id: makeId(questions.length + 1),
          section,
          prompt: 'Which of the following is a skill of a responsible Filipino consumer?',
          correct: item.correct,
          distractors: item.distractors
        }));
      }
      continue;
    }

    if (mode === 'matching') {
      const matchingLine = line.replace(/^\d+\.\s*/, '');
      if (/^[0-9]+\.|^[A-Z][a-z]+ .* bought|Maria wants|Anna chooses|Pedro reports|The government|Lina buys|A child|Miguel wants|A store|Rose gets|Carlo complains|Ella attends/i.test(line)) {
        const { correctAnswer } = matchingAnswerForPrompt(matchingLine);
        questions.push({
          id: makeId(questions.length + 1),
          section,
          type: 'multiple-choice',
          prompt: matchingLine,
          choices: CONSUMER_RIGHT_CHOICES,
          correctAnswer: keyForChoice(CONSUMER_RIGHT_CHOICES, correctAnswer),
          acceptedAnswers: [],
          points: 1
        });
      }
      continue;
    }

    if (mode !== 'multiple-choice' || isDirective(line) || line === title || lineHasChoice(line)) {
      continue;
    }

    const choiceLines = [];
    let cursor = i + 1;
    while (cursor < lines.length && lineHasChoice(lines[cursor])) {
      choiceLines.push(lines[cursor]);
      cursor += 1;
    }

    if (choiceLines.length === 0) continue;

    const choices = extractChoices(choiceLines);
    if (Object.keys(choices).length < 2) continue;

    questions.push({
      id: makeId(questions.length + 1),
      section,
      type: 'multiple-choice',
      prompt: line,
      choices,
      correctAnswer: answerForPrompt(line),
      acceptedAnswers: [],
      points: 1
    });
    i = cursor - 1;
  }

  return {
    title,
    source: 'MAPEH 4TH QUARTER.docx',
    totalPoints: questions.reduce((sum, question) => sum + Number(question.points ?? 1), 0),
    questions
  };
}
