import type { Language } from '../i18n/types';

/**
 * Teaching content for each topic, shown in the Concepts tab and from the "?"
 * on every statement block.
 *
 * References point at primary, stable sources — MDN, the Python docs, and
 * university course material — rather than tutorial blogs, so they stay valid
 * and are citable in an academic setting.
 */

export type ConceptId = 'variables' | 'output' | 'input' | 'conditionals' | 'loops';

export interface Reference {
  label: string;
  publisher: string;
  url: string;
  /** Which language the source is written in, so students can pick. */
  language: Language;
}

export interface ConceptCopy {
  title: string;
  summary: string;
  keyIdea: string;
  body: string[];
  mistakes: string[];
}

export interface Concept {
  id: ConceptId;
  /** Drives the accent colour, matching the statement palette. */
  category: 'variables' | 'io' | 'conditionals' | 'loops';
  statements: string[];
  readingMinutes: number;
  copy: Record<Language, ConceptCopy>;
  references: Reference[];
}

export const concepts: Concept[] = [
  {
    id: 'variables',
    category: 'variables',
    statements: ['declare', 'assign'],
    readingMinutes: 3,
    copy: {
      es: {
        title: 'Variables',
        summary: 'Cajas con nombre donde el programa guarda información para usarla después.',
        keyIdea:
          'Una variable asocia un nombre con un valor. El nombre no cambia; el valor sí puede cambiar.',
        body: [
          'Cuando un programa necesita recordar algo —la edad de una persona, un total acumulado, el nombre de un estudiante— lo guarda en una variable. Piensa en ella como una caja etiquetada: la etiqueta es el nombre y el contenido es el valor.',
          'Crear una variable y cambiarla son dos acciones distintas. «Crear variable» reserva la caja y le pone su primer contenido. «Cambiar variable» reemplaza el contenido de una caja que ya existe. Por eso no puedes cambiar algo que nunca creaste: no hay caja donde guardarlo.',
          'El tipo de dato describe qué clase de valor contiene la caja. Un número sirve para calcular, un texto para mostrar mensajes, y un valor verdadero/falso para tomar decisiones. Mezclarlos sin cuidado es una fuente común de errores: sumar el texto «5» con el número 5 no siempre da lo que esperas.',
        ],
        mistakes: [
          'Usar una variable antes de crearla. El robot te avisará de que esa variable no existe todavía.',
          'Confundir el nombre con el valor: si escribes «edad» entre comillas, estás usando el texto «edad», no el contenido de la variable.',
          'Suponer que cambiar una copia cambia el original. Cada asignación reemplaza el contenido completo de la caja.',
        ],
      },
      en: {
        title: 'Variables',
        summary: 'Named boxes where a program stores information to use later.',
        keyIdea:
          'A variable binds a name to a value. The name stays fixed; the value can change.',
        body: [
          'When a program needs to remember something — a person’s age, a running total, a student’s name — it stores it in a variable. Think of it as a labelled box: the label is the name and the contents are the value.',
          'Creating a variable and changing one are different actions. "Create variable" reserves the box and puts its first contents in. "Change variable" replaces the contents of a box that already exists. That is why you cannot change something you never created: there is no box to store it in.',
          'The data type describes what kind of value the box holds. Numbers are for calculating, text for showing messages, and true/false values for making decisions. Mixing them carelessly is a common source of bugs: adding the text "5" to the number 5 does not always give what you expect.',
        ],
        mistakes: [
          'Using a variable before creating it. The robot will tell you that variable does not exist yet.',
          'Confusing the name with the value: writing "age" in quotes uses the text "age", not the variable’s contents.',
          'Assuming that changing a copy changes the original. Each assignment replaces the whole contents of the box.',
        ],
      },
    },
    references: [
      {
        label: 'Almacenar la información necesaria: variables',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/es/docs/Learn_web_development/Core/Scripting/Variables',
        language: 'es',
      },
      {
        label: 'Storing the information you need — Variables',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Variables',
        language: 'en',
      },
      {
        label: 'Structure and Interpretation of Computer Programs, §1.1 — Naming and the Environment',
        publisher: 'MIT Press',
        url: 'https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-10.html#%_sec_1.1.2',
        language: 'en',
      },
    ],
  },
  {
    id: 'output',
    category: 'io',
    statements: ['say'],
    readingMinutes: 2,
    copy: {
      es: {
        title: 'Mostrar información',
        summary: 'Cómo un programa comunica resultados a la persona que lo usa.',
        keyIdea:
          'Un programa que calcula pero no muestra nada es invisible: la salida es lo que lo hace útil.',
        body: [
          'Mostrar en pantalla es la forma más directa que tiene un programa de comunicarse. En esta aplicación el robot «dice» el mensaje en voz alta; en JavaScript eso se escribe `console.log(...)` y en Python `print(...)`. Es la misma idea con distinta sintaxis.',
          'La salida también es tu mejor herramienta de depuración. Cuando un algoritmo no hace lo que esperas, mostrar el valor de una variable en puntos clave te dice exactamente dónde se desvía de lo que pensabas.',
          'Puedes combinar texto y variables para armar mensajes legibles. Unir «Hola, » con el contenido de una variable produce un saludo personalizado; a esto se le llama concatenación.',
        ],
        mistakes: [
          'Mostrar el nombre de la variable entre comillas en vez de su contenido.',
          'Olvidar separar las palabras al concatenar: «Hola» + nombre produce «HolaAna» sin el espacio.',
          'Suponer que mostrar un valor lo guarda. Mostrar no modifica ninguna variable.',
        ],
      },
      en: {
        title: 'Showing information',
        summary: 'How a program communicates results to the person using it.',
        keyIdea:
          'A program that calculates but shows nothing is invisible: output is what makes it useful.',
        body: [
          'Printing to the screen is the most direct way a program communicates. In this app the robot "says" the message out loud; in JavaScript that is written `console.log(...)` and in Python `print(...)`. Same idea, different syntax.',
          'Output is also your best debugging tool. When an algorithm does not do what you expect, printing a variable at key points tells you exactly where it diverges from your mental model.',
          'You can combine text and variables to build readable messages. Joining "Hello, " with a variable produces a personalised greeting; this is called concatenation.',
        ],
        mistakes: [
          'Printing the variable name in quotes instead of its contents.',
          'Forgetting to separate words when concatenating: "Hello" + name gives "HelloAna" with no space.',
          'Assuming that printing a value stores it. Printing does not modify any variable.',
        ],
      },
    },
    references: [
      {
        label: 'console.log()',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/es/docs/Web/API/console/log_static',
        language: 'es',
      },
      {
        label: 'Input and Output — The Python Tutorial',
        publisher: 'Python Software Foundation',
        url: 'https://docs.python.org/3/tutorial/inputoutput.html',
        language: 'en',
      },
    ],
  },
  {
    id: 'input',
    category: 'io',
    statements: ['ask'],
    readingMinutes: 3,
    copy: {
      es: {
        title: 'Solicitar información',
        summary: 'Cómo un programa recibe datos de la persona que lo usa.',
        keyIdea:
          'Todo lo que entra al programa llega como texto; convertirlo al tipo correcto es tu responsabilidad.',
        body: [
          'Un programa que siempre hace lo mismo con los mismos datos tiene poco valor. Pedir información al usuario lo vuelve general: el mismo algoritmo sirve para cualquier persona que lo ejecute.',
          'Aquí aparece un detalle importante que confunde a muchos principiantes: lo que el usuario escribe siempre llega como texto, incluso si teclea números. Si vas a calcular con ese dato, primero hay que convertirlo a número. Por eso la instrucción «Preguntar» te deja elegir el tipo de dato esperado.',
          'En JavaScript esa conversión se escribe `Number(...)` y en Python `float(...)` o `int(...)`. Si el usuario escribe algo que no es un número, la conversión falla, y un programa robusto debe anticipar ese caso.',
        ],
        mistakes: [
          'Sumar dos entradas sin convertirlas: «2» + «3» da «23» en vez de 5, porque se concatenan como texto.',
          'Suponer que el usuario siempre escribe lo que esperas. Un campo vacío o una palabra donde iba un número rompe el cálculo.',
          'Pedir un dato pero no guardarlo en ninguna variable, con lo que la respuesta se pierde.',
        ],
      },
      en: {
        title: 'Requesting information',
        summary: 'How a program receives data from the person using it.',
        keyIdea:
          'Everything entering the program arrives as text; converting it to the right type is your responsibility.',
        body: [
          'A program that always does the same thing with the same data has little value. Asking the user for input makes it general: the same algorithm serves anyone who runs it.',
          'Here is an important detail that trips up many beginners: whatever the user types always arrives as text, even when they type digits. If you are going to calculate with that value, you must convert it to a number first. That is why the "Ask" statement lets you choose the expected data type.',
          'In JavaScript that conversion is written `Number(...)`, and in Python `float(...)` or `int(...)`. If the user types something that is not a number, the conversion fails, and a robust program should anticipate that case.',
        ],
        mistakes: [
          'Adding two inputs without converting them: "2" + "3" gives "23" instead of 5, because they concatenate as text.',
          'Assuming the user always types what you expect. An empty field or a word where a number belongs breaks the calculation.',
          'Asking for a value but not storing it in any variable, so the answer is lost.',
        ],
      },
    },
    references: [
      {
        label: 'Window: prompt() method',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/prompt',
        language: 'en',
      },
      {
        label: 'Number — conversión de texto a número',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Number',
        language: 'es',
      },
      {
        label: 'input() — Built-in Functions',
        publisher: 'Python Software Foundation',
        url: 'https://docs.python.org/3/library/functions.html#input',
        language: 'en',
      },
    ],
  },
  {
    id: 'conditionals',
    category: 'conditionals',
    statements: ['if'],
    readingMinutes: 4,
    copy: {
      es: {
        title: 'Estructuras condicionales',
        summary: 'Permiten que el programa elija entre caminos distintos según los datos.',
        keyIdea:
          'Una condición es una pregunta de sí o no; su respuesta decide qué instrucciones se ejecutan.',
        body: [
          'Hasta ahora los algoritmos se leen de arriba abajo sin desviarse. Una condicional rompe esa línea recta: evalúa una condición y, según sea verdadera o falsa, ejecuta un grupo de instrucciones u otro.',
          'La condición siempre se reduce a verdadero o falso. Comparaciones como «nota ≥ 3» o «nombre = «Ana»» producen ese tipo de valor, llamado booleano en honor a George Boole.',
          'El bloque «si no» es opcional. Si solo te interesa actuar cuando algo se cumple, puedes omitirlo; el programa simplemente continúa. Cuando ambos caminos importan, «si no» garantiza que exactamente uno de los dos se ejecute.',
          'Puedes combinar condiciones con «y» y «o». Con «y» ambas partes deben cumplirse; con «o» basta una. Ten cuidado al mezclarlas: conviene agrupar con paréntesis para que la intención quede clara.',
        ],
        mistakes: [
          'Confundir comparar con asignar. Comparar pregunta «¿son iguales?»; asignar cambia el valor.',
          'Escribir condiciones imposibles, como pedir que un número sea a la vez mayor que 10 y menor que 5.',
          'Anidar condicionales innecesariamente cuando una combinación con «y» sería más clara.',
        ],
      },
      en: {
        title: 'Conditional structures',
        summary: 'They let a program choose between different paths depending on the data.',
        keyIdea:
          'A condition is a yes-or-no question; its answer decides which statements run.',
        body: [
          'So far algorithms read top to bottom without deviating. A conditional breaks that straight line: it evaluates a condition and, depending on whether it is true or false, runs one group of statements or another.',
          'The condition always reduces to true or false. Comparisons such as "grade ≥ 3" or "name = “Ana”" produce that kind of value, called boolean after George Boole.',
          'The "otherwise" block is optional. If you only care about acting when something holds, you can leave it out and the program simply continues. When both paths matter, "otherwise" guarantees that exactly one of the two runs.',
          'You can combine conditions with "and" and "or". With "and" both parts must hold; with "or" one is enough. Be careful mixing them: grouping with parentheses keeps the intent clear.',
        ],
        mistakes: [
          'Confusing comparison with assignment. Comparing asks "are these equal?"; assigning changes the value.',
          'Writing impossible conditions, such as asking a number to be both greater than 10 and less than 5.',
          'Nesting conditionals unnecessarily when a combination with "and" would read more clearly.',
        ],
      },
    },
    references: [
      {
        label: 'Tomar decisiones en tu código — condicionales',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/es/docs/Learn_web_development/Core/Scripting/Conditionals',
        language: 'es',
      },
      {
        label: 'Making decisions in your code — conditionals',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Conditionals',
        language: 'en',
      },
      {
        label: 'Boolean algebra and logic operators',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators',
        language: 'en',
      },
    ],
  },
  {
    id: 'loops',
    category: 'loops',
    statements: ['while', 'repeat', 'forEach'],
    readingMinutes: 5,
    copy: {
      es: {
        title: 'Ciclos',
        summary: 'Repiten un grupo de instrucciones sin tener que escribirlas muchas veces.',
        keyIdea:
          'Todo ciclo necesita una forma de terminar; si la condición nunca se vuelve falsa, el programa no para.',
        body: [
          'Escribir la misma instrucción diez veces es tedioso y difícil de mantener. Un ciclo expresa esa repetición una sola vez, y el programa la ejecuta tantas veces como haga falta.',
          'Elegir el ciclo correcto es parte del diseño. Cuando sabes de antemano cuántas repeticiones necesitas, «Repetir N veces» o «Desde… hasta» son los más claros. Cuando el número depende de algo que ocurre durante la ejecución —por ejemplo, seguir preguntando hasta que el usuario acierte— «Mientras» es el adecuado.',
          'El ciclo «Mientras» evalúa su condición antes de cada vuelta. Si la condición es falsa desde el principio, el cuerpo no se ejecuta ni una sola vez. Esto sorprende a quien espera que «al menos pase una vez».',
          'El error clásico es el ciclo infinito: la condición nunca se vuelve falsa porque olvidaste modificar la variable que la controla. Esta aplicación detiene el programa después de un número máximo de repeticiones y te lo indica, en vez de congelarse.',
        ],
        mistakes: [
          'Olvidar actualizar la variable de control dentro del ciclo, provocando un ciclo infinito.',
          'Equivocarse por uno en los límites: recorrer de 1 a 10 no es lo mismo que de 0 a 9.',
          'Modificar la variable del ciclo dentro del cuerpo cuando ya la controla el propio ciclo.',
        ],
      },
      en: {
        title: 'Loops',
        summary: 'They repeat a group of statements without writing them out many times.',
        keyIdea:
          'Every loop needs a way to end; if the condition never becomes false, the program never stops.',
        body: [
          'Writing the same statement ten times is tedious and hard to maintain. A loop expresses that repetition once, and the program runs it as many times as needed.',
          'Choosing the right loop is part of the design. When you know in advance how many repetitions you need, "Repeat N times" or "From… to" read most clearly. When the count depends on something that happens during execution — for example, asking until the user gets it right — "While" is the right choice.',
          'The "While" loop checks its condition before each pass. If the condition is false from the start, the body never runs at all. This surprises anyone expecting it to "run at least once".',
          'The classic bug is the infinite loop: the condition never turns false because you forgot to change the variable controlling it. This app stops the program after a maximum number of repetitions and tells you, instead of freezing.',
        ],
        mistakes: [
          'Forgetting to update the control variable inside the loop, causing an infinite loop.',
          'Off-by-one errors in the bounds: going from 1 to 10 is not the same as 0 to 9.',
          'Modifying the loop variable inside the body when the loop already controls it.',
        ],
      },
    },
    references: [
      {
        label: 'Bucles — Aprender desarrollo web',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/es/docs/Learn_web_development/Core/Scripting/Loops',
        language: 'es',
      },
      {
        label: 'Loops and iteration',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Loops_and_iteration',
        language: 'en',
      },
      {
        label: 'More Control Flow Tools — The Python Tutorial',
        publisher: 'Python Software Foundation',
        url: 'https://docs.python.org/3/tutorial/controlflow.html',
        language: 'en',
      },
    ],
  },
];

export const conceptsById = new Map(concepts.map((concept) => [concept.id, concept]));

/** Maps a statement kind to the concept that explains it. */
export const conceptForStatement = new Map<string, Concept>(
  concepts.flatMap((concept) => concept.statements.map((kind) => [kind, concept] as const)),
);
