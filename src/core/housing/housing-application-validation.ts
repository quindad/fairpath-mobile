import { isValidEmail } from '../forms/formatters.ts';
import { isValidDateForKind } from '../forms/dates.ts';

export type HousingApplicationForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  current_address: string;
  monthly_income: string;
  employer: string;
  employment_status: string;
  move_in_date: string;
  occupants: string;
  pets: string;
  housing_history: string;
  references: string;
  additional_notes: string;
};

export function validateHousingApplicationForm(form: HousingApplicationForm) {
  const errors: Partial<Record<keyof HousingApplicationForm, string>> = {};
  if (form.first_name.trim().length < 2) errors.first_name = 'Enter your first name.';
  if (form.last_name.trim().length < 2) errors.last_name = 'Enter your last name.';
  if (!isValidEmail(form.email)) errors.email = 'Enter a valid email address.';
  if (form.phone.replace(/\D/g, '').length !== 10) errors.phone = 'Enter a 10-digit phone number.';
  if (!isValidDateForKind(form.date_of_birth, 'dob')) errors.date_of_birth = 'Enter date of birth as MM/DD/YYYY.';
  if (!form.current_address.trim()) errors.current_address = 'Enter your current address or housing situation.';
  if (!form.employment_status.trim()) errors.employment_status = 'Select an employment status.';
  if (form.employment_status !== 'Unemployed' && !form.employer.trim()) errors.employer = 'Enter your employer or income source.';
  const income = Number(form.monthly_income.replace(/[^0-9.]/g, ''));
  if (!form.monthly_income.trim() || Number.isNaN(income) || income < 0) errors.monthly_income = 'Enter gross monthly income. Use 0 if none.';
  if (!isValidDateForKind(form.move_in_date, 'future')) errors.move_in_date = 'Choose today or a future move-in date.';
  const occupants = Number(form.occupants);
  if (!Number.isInteger(occupants) || occupants < 1) errors.occupants = 'Enter at least 1 occupant.';
  if (!form.pets.trim()) errors.pets = 'Enter pet details or select None.';
  if (!form.housing_history.trim()) errors.housing_history = 'Enter housing history or state that you have no prior rental history.';
  if (!form.references.trim()) errors.references = 'Enter a reference or state None available.';
  return errors;
}
