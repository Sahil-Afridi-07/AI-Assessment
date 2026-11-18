// Builds the PDF for one finished attempt with pdfkit (loaded lazily so the API runs without it).
const fmtTime = (s) => (s == null ? '-' : `${Math.floor(s / 60)}m ${s % 60}s`);

function renderReportPdf(PDFDocument, report, studentName, res) {
  const { attempt, test, review } = report;
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Assessment report - ${test?.title || ''}` } });
  doc.pipe(res);
  const W = doc.page.width - 96;

  doc.fontSize(20).fillColor('#1F2A3C').text('Assessment Report', { align: 'left' });
  doc.moveDown(0.2).fontSize(12).fillColor('#555').text(`${test?.title || 'Assessment'}`);
  doc.fontSize(10).text(`Student: ${studentName}   |   Submitted: ${attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : '-'}   |   Status: ${attempt.status}`);
  doc.moveDown();

  doc.fontSize(13).fillColor('#1F2A3C').text('Summary');
  doc.fontSize(11).fillColor('#222')
    .text(`Score: ${attempt.score}/${attempt.total} (${attempt.percentage}%)`)
    .text(`Correct: ${attempt.correctCount}   Incorrect: ${attempt.incorrectCount}   Unanswered: ${attempt.unansweredCount}`)
    .text(`Time taken: ${fmtTime(attempt.timeTakenSec)}`);
  doc.moveDown();

  if ((attempt.topicBreakdown || []).length) {
    doc.fontSize(13).fillColor('#1F2A3C').text('Topic breakdown');
    doc.fontSize(10).fillColor('#222');
    for (const t of attempt.topicBreakdown) doc.text(`- ${t.topic}: ${t.correct}/${t.total}`);
    doc.moveDown();
  }
  doc.fontSize(13).fillColor('#1F2A3C').text('Strengths and weaknesses');
  doc.fontSize(10).fillColor('#222')
    .text(`Strengths: ${attempt.strengths.length ? attempt.strengths.join(', ') : 'none identified yet'}`)
    .text(`Needs improvement: ${attempt.weaknesses.length ? attempt.weaknesses.join(', ') : 'none identified'}`);
  doc.moveDown();
  if (attempt.feedback) {
    doc.fontSize(13).fillColor('#1F2A3C').text('Improvement recommendations');
    doc.fontSize(10).fillColor('#222').text(attempt.feedback, { width: W });
    doc.moveDown();
  }

  doc.addPage();
  doc.fontSize(14).fillColor('#1F2A3C').text('Question-wise results');
  doc.moveDown(0.5);
  review.forEach((r, i) => {
    if (doc.y > doc.page.height - 170) doc.addPage();
    doc.fontSize(11).fillColor(r.isCorrect ? '#2e7d54' : '#b3372f').text(`Q${i + 1}. ${r.isCorrect ? 'Correct' : r.selected === null ? 'Unanswered' : 'Incorrect'}  (${r.difficulty}${r.topic ? ', ' + r.topic : ''})`);
    doc.fillColor('#111').fontSize(11).text(r.text, { width: W });
    doc.fontSize(10).fillColor('#333');
    r.options.forEach((o, k) => {
      const tag = k === r.correctOption ? '  [correct]' : '';
      const mine = k === r.selected ? '  [your answer]' : '';
      doc.text(`   ${'ABCD'[k]}. ${o}${tag}${mine}`, { width: W });
    });
    if (r.explanation) doc.fillColor('#555').text(`Explanation: ${r.explanation}`, { width: W });
    doc.moveDown(0.8);
  });
  doc.end();
}

module.exports = { renderReportPdf };
