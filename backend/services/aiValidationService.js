// backend/services/aiValidationService.js
// AI-powered validation service for scoring founder answers

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY not set. AI validation will use fallback scoring.');
}

/**
 * Validates and scores a single answer using Claude AI
 * @param {Object} question - The question object with id, question, hint, category, weight
 * @param {String} answer - The founder's answer
 * @returns {Promise<Object>} { score: number, feedback: string, strengths: [], improvements: [] }
 */
async function scoreAnswer(question, answer) {
  if (!answer || answer.trim().length < 10) {
    return {
      score: 0,
      feedback: 'Answer is too short or missing. Please provide a detailed response.',
      strengths: [],
      improvements: ['Provide a more detailed answer']
    };
  }

  // If no API key, use simple heuristic scoring
  if (!ANTHROPIC_API_KEY) {
    return fallbackScoring(question, answer);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are an expert startup advisor evaluating a founder's response to a validation question.

**Question**: ${question.question}
**Hint/Context**: ${question.hint}
**Category**: ${question.category}

**Founder's Answer**:
${answer}

Please evaluate this answer and provide:
1. A score from 0-100 based on:
   - Specificity and concrete details (not vague)
   - Evidence or data provided
   - Depth of thinking and insight
   - Relevance to the question
   - Feasibility and realism

2. Brief feedback (2-3 sentences)
3. Key strengths (1-3 bullet points)
4. Areas for improvement (1-3 bullet points)

Respond ONLY with valid JSON in this exact format:
{
  "score": <number 0-100>,
  "feedback": "<string>",
  "strengths": ["<string>", ...],
  "improvements": ["<string>", ...]
}`
        }]
      })
    });

    if (!response.ok) {
      console.error('AI API error:', response.status, response.statusText);
      return fallbackScoring(question, answer);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    
    // Extract JSON from response (remove any markdown code fences)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response');
      return fallbackScoring(question, answer);
    }

    const result = JSON.parse(jsonMatch[0]);
    
    // Validate the response structure
    if (typeof result.score !== 'number' || result.score < 0 || result.score > 100) {
      console.error('Invalid score in AI response');
      return fallbackScoring(question, answer);
    }

    return {
      score: Math.round(result.score),
      feedback: result.feedback || 'No feedback provided',
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      improvements: Array.isArray(result.improvements) ? result.improvements : []
    };

  } catch (error) {
    console.error('AI validation error:', error);
    return fallbackScoring(question, answer);
  }
}

/**
 * Fallback scoring when AI is unavailable
 * Uses heuristics: length, keywords, structure
 */
function fallbackScoring(question, answer) {
  const words = answer.trim().split(/\s+/).length;
  const hasNumbers = /\d+/.test(answer);
  const hasSpecifics = /\b(because|specifically|example|data|evidence|tested|validated|measured)\b/i.test(answer);
  
  let score = 30; // Base score for attempting
  
  // Length bonus (up to 20 points)
  if (words >= 50) score += 20;
  else if (words >= 30) score += 15;
  else if (words >= 20) score += 10;
  else if (words >= 10) score += 5;
  
  // Specificity bonus (up to 30 points)
  if (hasNumbers) score += 15;
  if (hasSpecifics) score += 15;
  
  // Detail bonus (up to 20 points)
  if (answer.includes('\n') || answer.includes('.')) score += 10;
  if (words > 100) score += 10;
  
  score = Math.min(score, 100);
  
  const feedback = score >= 70 
    ? 'Good answer with reasonable detail.'
    : score >= 50
    ? 'Answer needs more specifics and evidence.'
    : 'Answer is too vague. Provide concrete examples and data.';
  
  return {
    score,
    feedback,
    strengths: score >= 70 ? ['Answer provides some detail'] : [],
    improvements: score < 70 ? ['Add more specific examples', 'Include data or evidence'] : []
  };
}

/**
 * Validates all answers for a stage and returns weighted score
 * @param {Array} questions - Array of question objects
 * @param {Array} answers - Array of answer objects with { id, answer }
 * @returns {Promise<Object>} { stageScore, processedAnswers, overallFeedback }
 */
async function validateStage(questions, answers) {
  const processedAnswers = [];
  let weightedSum = 0;
  let totalWeight = 0;

  // Score each answer in parallel for speed
  const scoringPromises = answers.map(async (answerObj) => {
    const question = questions.find(q => q.id === answerObj.id);
    if (!question) {
      return null;
    }

    const result = await scoreAnswer(question, answerObj.answer);
    const weight = question.weight || 1.0;

    weightedSum += result.score * weight;
    totalWeight += weight;

    return {
      question: question.question,
      answer: answerObj.answer,
      score: result.score,
      weight,
      category: question.category,
      feedback: result.feedback,
      strengths: result.strengths,
      improvements: result.improvements
    };
  });

  const results = await Promise.all(scoringPromises);
  processedAnswers.push(...results.filter(r => r !== null));

  const stageScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  // Generate overall feedback
  const avgScore = stageScore;
  const overallFeedback = avgScore >= 80
    ? 'Excellent responses! You have clearly thought through this stage.'
    : avgScore >= 70
    ? 'Good work! Your answers demonstrate solid understanding.'
    : avgScore >= 50
    ? 'You\'re on the right track, but several answers need more depth and specifics.'
    : 'Your answers need significant improvement. Focus on providing concrete examples and evidence.';

  return {
    stageScore,
    processedAnswers,
    overallFeedback
  };
}

module.exports = {
  scoreAnswer,
  validateStage
};