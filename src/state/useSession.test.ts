import { describe, expect, it } from 'vitest';

import { initialsFrom, nameFrom } from './useSession';

describe('nameFrom', () => {
  it('prefers the full name', () => {
    expect(nameFrom({ firstName: 'Juan David', lastName: 'Pérez' }, 'jd@u.edu')).toBe(
      'Juan David Pérez',
    );
  });

  it('falls back to the email local part when the profile is empty', () => {
    expect(nameFrom({ firstName: '', lastName: '' }, 'jdperez@correo.edu')).toBe('jdperez');
    expect(nameFrom(null, 'jdperez@correo.edu')).toBe('jdperez');
  });

  it('copes with only one of the two names', () => {
    expect(nameFrom({ firstName: 'Ana', lastName: '' }, 'a@u.edu')).toBe('Ana');
  });

  it('has nothing to show when signed out', () => {
    expect(nameFrom(null, null)).toBeNull();
  });
});

describe('initialsFrom', () => {
  it('takes one letter from each name rather than two from the first', () => {
    expect(initialsFrom({ firstName: 'Juan David', lastName: 'Pérez Ruiz' }, null)).toBe('JP');
  });

  it('handles accents and a single name', () => {
    expect(initialsFrom({ firstName: 'Ángela', lastName: '' }, null)).toBe('Á');
  });

  it('falls back to the first letter of the email', () => {
    expect(initialsFrom(null, 'jdperez@correo.edu')).toBe('J');
  });

  // A name may well start with an emoji or a surrogate pair; slicing by code
  // unit would split it into a broken half-character.
  it('does not split a surrogate pair', () => {
    expect(initialsFrom({ firstName: '𝒥ulia', lastName: 'Ruiz' }, null)).toBe('𝒥R');
  });
});
