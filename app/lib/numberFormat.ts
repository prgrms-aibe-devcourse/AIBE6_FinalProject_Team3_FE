/**
 * 정수 입력값에 자릿수 콤마를 붙인다. 숫자가 아닌 문자는 전부 제거.
 * 보증금/월세처럼 항상 정수인 금액 입력에 사용한다.
 * 제출 시엔 각 폼의 handleSubmit이 `.replace(/,/g, '')`로 콤마를 다시 제거하고 파싱한다.
 */
export function formatIntegerInput(raw: string): string {
  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (digitsOnly === '') return '';
  return Number(digitsOnly).toLocaleString('en-US');
}

/**
 * 소수점이 있는 입력값(면적 등)의 정수부에만 자릿수 콤마를 붙인다. 소수점 이하는 그대로 둔다 -
 * 입력 중간("42." 같은 상태)에 강제로 잘라버리면 타이핑이 끊겨 불편하기 때문. 두 번째 점부터는
 * 전부 무시한다(소수점은 하나만 허용).
 */
export function formatDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const firstDotIndex = cleaned.indexOf('.');

  if (firstDotIndex === -1) {
    return cleaned === '' ? '' : Number(cleaned).toLocaleString('en-US');
  }

  const integerPart = cleaned.slice(0, firstDotIndex);
  const decimalPart = cleaned.slice(firstDotIndex + 1).replace(/\./g, '');
  const formattedInteger = integerPart === '' ? '' : Number(integerPart).toLocaleString('en-US');
  return `${formattedInteger}.${decimalPart}`;
}

/**
 * 전용면적(㎡)을 평 단위 문구로 변환한다. 1평 = 3.305785㎡ (공식 환산 계수).
 * 소수점 첫째 자리까지 반올림해서 보여준다 - 정밀한 값이 아니라 감을 잡기 위한 참고용 병기이므로.
 */
export function formatAreaWithPyeong(areaSqm: number): string {
  const pyeong = areaSqm / 3.305785;
  return `${areaSqm}㎡ (${pyeong.toFixed(1)}평)`;
}
