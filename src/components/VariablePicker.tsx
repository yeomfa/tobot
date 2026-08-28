import { useTranslation } from '../i18n/context';
import { Picker } from './Picker';

interface VariablePickerProps {
  /** The name currently referred to, which may no longer exist. */
  value: string;
  /** Names in scope at this point in the algorithm. */
  variables: string[];
  onChange: (name: string) => void;
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
export function VariablePicker({ value, variables, onChange }: VariablePickerProps) {
  const { d } = useTranslation();

  return (
    <Picker
      value={value}
      groups={[
        {
          options: [
            /*
              A name nothing declares stays listed rather than being swapped
              for a real one: the reference is broken either way, and quietly
              repointing it hides which name was wrong.
            */
            ...(variables.includes(value) ? [] : [{ value, label: value || '···' }]),
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
