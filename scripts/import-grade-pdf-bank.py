import json
import re
import sys
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from pypdf import PdfReader

AREAS = {'English', 'Mathematics', 'Science', 'Social Studies', 'Logic and Digital Skills'}
GRADE_ORDER = ['7', '8', '9', '10']
SKIP_PREFIXES = (
    'Scholarship Entrance Online MCQ Question Bank',
    'Page ',
    'Teacher copy',
    'SCHOLARSHIP ENTRANCE ONLINE TEST',
    'Original question bank',
    'Total items',
    'Question type',
    'Suggested time',
    'Suggested online settings',
    'Coverage',
    'Student Instructions',
    'Teacher note:',
    'Select the best answer',
    'Recommended scoring guide',
    'Score ='
)
SKIP_EXACT = {
    '30',
    'Multiple choice with four options per item',
    '45 minutes',
    'Shuffle questions, shuffle choices, one attempt, show score after submission',
    'English, Mathematics, Science, Social Studies, Logic and Digital Skills',
    'Use this key when encoding correct answers into the online exam system. Remove this page from student copies.',
    'No.',
    'Ans.',
    'Area'
}


def clean(value):
    return re.sub(r'\s+', ' ', str(value).replace('\x7f', '').strip())


def text_from_pdf(path):
    return '\n'.join(page.extract_text() or '' for page in PdfReader(str(path)).pages)


def parse_answer_key(text):
    key_text = text[text.lower().rfind('answer key'):]
    lines = [clean(line) for line in key_text.splitlines() if clean(line)]
    key = {}
    for index, line in enumerate(lines[:-1]):
        if line.isdigit() and re.fullmatch(r'[A-D]', lines[index + 1] or ''):
            key[int(line)] = lines[index + 1].lower()
    return key


def usable_lines(text, grade_number):
    body = text.split('Answer Key')[0]
    lines = []
    for raw_line in body.splitlines():
        line = clean(raw_line)
        if not line:
            continue
        if line in SKIP_EXACT:
            continue
        if line in {f'Grade {grade_number}', f'Grade {grade_number} Multiple-Choice Question Set', f'Grade {grade_number} Questions'}:
            continue
        if any(line.startswith(prefix) for prefix in SKIP_PREFIXES):
            continue
        if line.startswith(('Read each question', 'Choose only one answer', 'Do not refresh', 'Use scratch paper', 'Review your answers')):
            continue
        lines.append(line)
    return lines


def parse_questions(pdf_path):
    text = text_from_pdf(pdf_path)
    grade_match = re.search(r'Grade_(\d+)_', pdf_path.name)
    if not grade_match:
        raise ValueError(f'Cannot read grade level from {pdf_path.name}')

    grade_number = grade_match.group(1)
    grade_level = f'Grade {grade_number}'
    key = parse_answer_key(text)
    lines = usable_lines(text, grade_number)
    area = 'General'
    current = None
    questions = []

    def finish_current():
        nonlocal current
        if not current:
            return
        chunks = current['lines']
        option_positions = [
            index for index, line in enumerate(chunks)
            if re.match(r'^[A-D]\.\s*', line)
        ]
        if len(option_positions) != 4:
            raise ValueError(f'{pdf_path.name} question {current["number"]} has {len(option_positions)} choices')

        prompt = clean(' '.join(chunks[:option_positions[0]]))
        choices = {}
        for option_index, position in enumerate(option_positions):
            label = chunks[position][0].lower()
            start_text = re.sub(r'^[A-D]\.\s*', '', chunks[position])
            end = option_positions[option_index + 1] if option_index + 1 < len(option_positions) else len(chunks)
            choices[label] = clean(' '.join([start_text] + chunks[position + 1:end]))

        number = current['number']
        if number not in key:
            raise ValueError(f'{pdf_path.name} is missing answer key item {number}')
        questions.append({
            'id': f'g{grade_number}-q{number:02d}',
            'gradeLevel': grade_level,
            'section': current['area'],
            'type': 'multiple-choice',
            'prompt': prompt,
            'choices': choices,
            'correctAnswer': key[number],
            'acceptedAnswers': [],
            'points': 1
        })
        current = None

    for line in lines:
        if line in AREAS:
            finish_current()
            area = line
            continue
        question_match = re.match(r'^(\d+)\.\s*(.*)$', line)
        if question_match:
            finish_current()
            current = {
                'number': int(question_match.group(1)),
                'area': area,
                'lines': [question_match.group(2)]
            }
        elif current:
            current['lines'].append(line)

    finish_current()
    if len(questions) != 30:
        raise ValueError(f'{pdf_path.name} parsed {len(questions)} questions, expected 30')
    return questions


def extract_zip(zip_path, destination):
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(destination)


def main():
    zip_path = Path(sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\GIGABYTE\Downloads\Grade_7_to_10_Online_MCQ_Question_Banks.zip')
    output_path = Path(sys.argv[2] if len(sys.argv) > 2 else 'data/questions.json')
    if not zip_path.exists():
        raise FileNotFoundError(zip_path)

    with TemporaryDirectory() as temp_dir:
        extract_dir = Path(temp_dir)
        extract_zip(zip_path, extract_dir)
        pdfs = sorted(
            extract_dir.glob('Grade_*_Online_MCQ_Question_Bank.pdf'),
            key=lambda path: GRADE_ORDER.index(re.search(r'Grade_(\d+)_', path.name).group(1))
        )
        questions = []
        for pdf in pdfs:
            parsed = parse_questions(pdf)
            questions.extend(parsed)
            print(f'Imported {len(parsed)} questions from {pdf.name}')

    exam = {
        'title': 'Scholarship Entrance Exam Grade 7 to 10 Question Bank',
        'source': zip_path.name,
        'totalPoints': len(questions),
        'questions': questions
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(exam, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'Saved {len(questions)} questions to {output_path}')


if __name__ == '__main__':
    main()
