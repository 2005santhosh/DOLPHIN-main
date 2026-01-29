// backend/services/geminiValidationService.js
// AI-powered validation using Google Gemini API (FREE with generous limits)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY not set. AI validation will use fallback scoring.');
}

/**
 * Validates and scores a single answer using Google Gemini AI
 * Gemini API is FREE with 15 requests/minute (900/hour) and 1500 requests/day
 * @param {Object} question - The question object
 * @param {String} answer - The founder's answer
 * @returns {Promise<Object>} { score, feedback, strengths, improvements }
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

  // If no API key, use fallback scoring
  if (!GEMINI_API_KEY) {
    return fallbackScoring(question, answer);
  }

  try {
    const prompt = `You are an expert startup advisor evaluating a founder's response to a validation question.

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
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 1024
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', response.status, errorData);
      return fallbackScoring(question, answer);
    }

    const data = await response.json();
    
    // Extract text from Gemini response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error('No text in Gemini response');
      return fallbackScoring(question, answer);
    }

    // Extract JSON from response (remove markdown code fences if present)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in Gemini response');
      return fallbackScoring(question, answer);
    }

    const result = JSON.parse(jsonMatch[0]);
    
    // Validate response structure
    if (typeof result.score !== 'number' || result.score < 0 || result.score > 100) {
      console.error('Invalid score in Gemini response');
      return fallbackScoring(question, answer);
    }

    return {
      score: Math.round(result.score),
      feedback: result.feedback || 'No feedback provided',
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      improvements: Array.isArray(result.improvements) ? result.improvements : []
    };

  } catch (error) {
    console.error('Gemini validation error:', error);
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
 * Validates all answers for a stage with rate limiting
 * Gemini free tier: 15 RPM, 1500 RPD
 * @param {Array} questions - Array of question objects
 * @param {Array} answers - Array of answer objects
 * @returns {Promise<Object>} { stageScore, processedAnswers, overallFeedback }
 */
async function validateStage(questions, answers) {
  const processedAnswers = [];
  let weightedSum = 0;
  let totalWeight = 0;

  // Process answers with delay to respect rate limits (15 RPM)
  // Add 5 second delay between requests to be safe
  for (const answerObj of answers) {
    const question = questions.find(q => q.id === answerObj.id);
    if (!question) {
      continue;
    }

    const result = await scoreAnswer(question, answerObj.answer);
    const weight = question.weight || 1.0;

    weightedSum += result.score * weight;
    totalWeight += weight;

    processedAnswers.push({
      question: question.question,
      answer: answerObj.answer,
      score: result.score,
      weight,
      category: question.category,
      feedback: result.feedback,
      strengths: result.strengths,
      improvements: result.improvements
    });

    // Add delay between API calls (only if using Gemini API)
    if (GEMINI_API_KEY && answers.indexOf(answerObj) < answers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
    }
  }

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

/**
 * Batch validate with better rate limiting
 * Processes 10 questions in ~50 seconds (respecting 15 RPM)
 */
async function batchValidateStage(questions, answers) {
  const BATCH_SIZE = 3; // Process 3 at a time
  const BATCH_DELAY = 15000; // 15 seconds between batches (4 batches per minute = 12 requests/min)
  
  const processedAnswers = [];
  let weightedSum = 0;
  let totalWeight = 0;

  // Split into batches
  const batches = [];
  for (let i = 0; i < answers.length; i += BATCH_SIZE) {
    batches.push(answers.slice(i, i + BATCH_SIZE));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    // Process batch in parallel
    const batchPromises = batch.map(async (answerObj) => {
      const question = questions.find(q => q.id === answerObj.id);
      if (!question) return null;

      const result = await scoreAnswer(question, answerObj.answer);
      const weight = question.weight || 1.0;

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

    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(result => {
      if (result) {
        processedAnswers.push(result);
        weightedSum += result.score * result.weight;
        totalWeight += result.weight;
      }
    });

    // Delay between batches (except for last batch)
    if (batchIndex < batches.length - 1) {
      console.log(`Processed batch ${batchIndex + 1}/${batches.length}, waiting ${BATCH_DELAY/1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  const stageScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

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
  validateStage,
  batchValidateStage
};