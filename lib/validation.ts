// Shared client-side form validation used by the auth screens.
// Kept in lib (not in components) so the rules are unit-testable.

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export interface RegisterFormInput {
  firstName: string
  lastName: string
  email: string
  department: string
  password: string
  confirm: string
  agreed: boolean
}

/** The submit button stays disabled until every rule here passes. */
export function isRegisterFormComplete(input: RegisterFormInput): boolean {
  const { firstName, lastName, email, department, password, confirm, agreed } = input

  const allFilled =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    department.trim().length > 0 &&
    password.trim().length > 0 &&
    confirm.trim().length > 0

  const pwOk = password === confirm
  const emailValid = isValidEmail(email)

  return allFilled && pwOk && emailValid && agreed
}

export function isLoginFormComplete(email: string, password: string): boolean {
  return isValidEmail(email) && password.trim().length > 0
}
