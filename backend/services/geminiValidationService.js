// backend/services/geminiValidationService.js
// AI-powered validation using Google Gemini API

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY not set. AI validation will use fallback scoring.');
}

/**
 * Fallback scoring when AI is unavailable — heuristic based on answer quality
 */
function fallbackScoring(question, answer) {
  const words = answer.trim().split(/\s+/).length;
  const hasNumbers = /\d+/.test(answer);
  const hasSpecifics = /\b(because|specifically|example|data|evidence|tested|validated|measured|customers?|users?|market|revenue|growth)\b/i.test(answer);

  let score = 45;
  if (words >= 60) score += 20;
  else if (words >= 40) score += 15;
  else if (words >= 20) score += 10;
  else if (words >= 10) score += 5;

  if (hasNumbers) score += 12;
  if (hasSpecifics) score += 13;
  if (answer.includes('\n') || answer.includes('-')) score += 5;
  if (words > 100) score += 5;

  score = Math.min(score, 82);

  return {
    score,
    feedback: score >= 70
      ? 'Good answer with reasonable detail.'
      : score >= 50
      ? 'Answer needs more specifics and evidence.'
      : 'Answer is too vague. Provide concrete examples and data.',
    strengths: score >= 70 ? ['Provides some detail'] : [],
    improvements: score < 70 ? ['Add specific examples', 'Include data or evidence'] : [],
  };
}

/**
 * Score ALL answers for a stage in a SINGLE Gemini API call.
 * This avoids the per-question delay and stays well within the 30s timeout.
 */
async function batchValidateStage(questions, answers) {
  // Build a combined prompt for all questions at once
  const qaList = answers.map((ans, i) => {
    const q = questions.find(q => q.id === ans.id) || questions[i];
    return `Q${ans.id} [${q?.category || 'general'}] (weight: ${q?.weight || 1.0}): ${q?.question || ''}
Hint: ${q?.hint || ''}
Answer: ${ans.answer || '(no answer)'}`;
  }).join('\n\n');

  const prompt = `You are an expert startup advisor evaluating an EARLY-STAGE startup founder.
Assume this is an idea-stage or MVP-stage company. Score based on clarity of thinking, realism, and progress relative to stage.
Do NOT penalize lack of revenue, users, or large datasets if reasoning is sound.

Evaluate ALL ${answers.length} answers below and return a JSON array with one object per answer.

${qaList}

For each answer provide:
- score: 0-100 (specificity, evidence, depth, relevance, feasibility)
- feedback: 1-2 sentence evaluation
- strengths: array of 1-2 strings (what was good)
- improvements: array of 1-2 strings (what to improve)

Respond ONLY with valid JSON array, no markdown, no explanation:
[{"id": <question_id>, "score": <0-100>, "feedback": "<string>", "strengths": [...], "improvements": [...]}, ...]`;

  let aiResults = null;

  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              topK: 32,
              topP: 1,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        // Strip markdown fences if present
        const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            aiResults = parsed;
            console.log(`✓ Gemini batch scored ${parsed.length} answers`);
          }
        }
      } else {
        const errText = await response.text().catch(() => '');
        console.error(`Gemini API error ${response.status}:`, errText);
      }
    } catch (err) {
      console.error('Gemini batch validation error:', err.message);
    }
  }

  // Build processedAnswers — use AI results if available, fallback otherwise
  const processedAnswers = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const ans of answers) {
    const question = questions.find(q => q.id === ans.id);
    if (!question) continue;

    const weight = question.weight || 1.0;
    let scored;

    if (aiResults) {
      const aiItem = aiResults.find(r => r.id === ans.id || r.id === String(ans.id));
      if (aiItem && typeof aiItem.score === 'number') {
        scored = {
          score: Math.max(0, Math.min(100, Math.round(aiItem.score))),
          feedback: aiItem.feedback || '',
          strengths: Array.isArray(aiItem.strengths) ? aiItem.strengths : [],
          improvements: Array.isArray(aiItem.improvements) ? aiItem.improvements : [],
        };
      }
    }

    if (!scored) {
      scored = fallbackScoring(question, ans.answer || '');
    }

    weightedSum += scored.score * weight;
    totalWeight += weight;

    processedAnswers.push({
      question: question.question,
      answer: ans.answer || '',
      score: scored.score,
      weight,
      category: question.category,
      feedback: scored.feedback,
      strengths: scored.strengths,
      improvements: scored.improvements,
    });
  }

  const rawScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  // Soft curve: slightly boost scores in the 60-79 range
  let stageScore = rawScore;
  if (rawScore >= 60 && rawScore < 70) stageScore = Math.min(rawScore + 5, 69);
  else if (rawScore >= 70 && rawScore < 80) stageScore = Math.min(rawScore + 3, 100);
  stageScore = Math.min(stageScore, 100);

  const overallFeedback =
    stageScore >= 80 ? 'Excellent responses! You have clearly thought through this stage.' :
    stageScore >= 70 ? 'Good work! Your answers demonstrate solid understanding.' :
    stageScore >= 50 ? 'Your idea shows promise. Strengthen a few answers with clearer examples or validation to move forward.' :
    'Your answers need significant improvement. Focus on providing concrete examples and evidence.';

  console.log(`Stage score: ${stageScore}% (raw: ${rawScore}%, ${aiResults ? 'AI' : 'fallback'})`);

  return { stageScore, processedAnswers, overallFeedback };
}

// Keep legacy exports for backward compatibility
async function scoreAnswer(question, answer) {
  if (!answer || answer.trim().length < 10) {
    return { score: 0, feedback: 'Answer too short.', strengths: [], improvements: ['Provide a detailed answer'] };
  }
  return fallbackScoring(question, answer);
}

async function validateStage(questions, answers) {
  return batchValidateStage(questions, answers);
}

module.exports = { scoreAnswer, validateStage, batchValidateStage };
