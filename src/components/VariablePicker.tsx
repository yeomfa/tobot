import { useTranslation } from '../i18n/context';
import { Picker } from './Picker';

interface VariablePickerProps {
  /** The name currently referred to, which may no longer exist. */
  value: string;
  /** Names in scope at this point in the algorithm. */
  variables: string[];
  onChange: (name: string) => void;
  /**
   * A name the student never chose — the placeholder a freshly dropped
   * statement carries. It is shown as empty rather than offered as an option,
   * because listing it invites picking a variable that does not exist.
   */
  placeholder?: string;
}

/**
 * Choosing a variable, wherever that happens.
 *
 * Picking the target of `cambiar` and picking a variable inside an expression
 * are the same act, so they are the same control — they had drifted into two
 * copies with different variants, and looked like different things to a
 * student doing the same thing twice.
 *
 * The styling lives with the component rather than under `.expr`, which is
 * what had confined the variable colour to expressions.
 */
export function VariablePicker({
  value,
  variables,
  onChange,
  placeholder,
}: VariablePickerProps) {
  const { d } = useTranslation();

  /*
    Whether this name is one the student put there. A statement dropped from
    the palette arrives holding the factory's placeholder, which nothing
    declared and nobody typed — offering it as a choice made the list read as
    if a variable called `x` existed somewhere.
  */
  const chosen = value !== placeholder;
  const dangling = value !== '' && chosen && !variables.includes(value);

  return (
    <Picker
      value={value}
      groups={[
        {
          options: [
            /*
              A name the student did choose stays listed even when nothing
              declares it: the reference is broken either way, and quietly
              repointing it hides which name was wrong. A placeholder is not
              that — it was never a choice, so it is not offered as one.
            */
            ...(dangling ? [{ value, label: value }] : []),
            ...variables.map((name) => ({ value: name, label: name })),
          ],
        },
      ]}
      onChange={onChange}
      label={d.fields.name}
      variant="reference"
    />
  );
}
