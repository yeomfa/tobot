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

  /*
    A name that is set but declared nowhere. An unnamed statement holds the
    empty string, which is not a reference to anything and so is not one of
    these — new statements start unnamed rather than carrying a stand-in name,
    which is what used to put a phantom `x` in scope.
  */
  const dangling = value !== '' && !variables.includes(value);

  return (
    <Picker
      value={value}
      groups={[
        {
          options: [
            /*
              A name the student typed that nothing declares stays listed: the
              reference is broken either way, and quietly repointing it hides
              which name was wrong.
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
