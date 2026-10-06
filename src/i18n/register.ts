// Participant pages: /code, /details, /login, /edit.
// Headings mark their accent word with *asterisks* (rendered as <em>).
export default {
  es: {
    stepOf: 'Paso {n} de {total}',
    preview: 'Así se verá tu lámina',

    // /code
    codeTitle: 'Añade tu *lámina*',
    codeIntro: 'Escribe el código de acceso que te compartió quien organiza la clase.',
    codeLabel: 'Código de acceso',
    continue: 'Continuar',
    checking: 'Comprobando…',
    askOrganizer: 'Pídele el código actual a quien organiza.',
    haveSlide: '¿Ya tienes tu lámina?',
    loginToEdit: 'Inicia sesión para editarla',
    existingTitle: 'Ya tienes una *lámina*',
    existingBody: 'Este dispositivo recuerda tu lámina. Puedes editarla o ir a verla; también puedes registrar a otra persona aquí abajo.',
    editMine: 'Editar mi lámina',

    // /details
    detailsTitle: 'Cuéntanos de *ti*',
    detailsIntro: 'Tu nombre y lo que aprendiste quedarán escritos en tu lámina, a la vista de toda la clase.',
    fullName: 'Nombre completo',
    fullNamePlaceholder: 'Como quieres que aparezca',
    email: 'Correo',
    emailHint: 'Solo tú y el administrador pueden verlo. Lo usarás para volver a entrar.',
    learning: '¿Qué aprendiste en clase?',
    learningPlaceholder: 'Una idea, un concepto, algo que te sorprendió…',
    submit: 'Poner mi lámina en la pizarra',
    saving: 'Guardando…',
    goToLogin: 'Inicia sesión',

    // /login
    loginTitle: 'Volver a *entrar*',
    loginIntro: 'Usa el correo con el que te registraste y el código de acceso actual de la clase.',
    loginCodeHint: 'Es el mismo código que se usa para registrarse.',
    loginSubmit: 'Entrar',
    signingIn: 'Entrando…',
    noSlide: '¿Aún no tienes lámina?',
    registerLink: 'Regístrate',

    // /edit
    editTitle: 'Edita tu *lámina*',
    editIntro: 'Los cambios se verán en la pizarra en cuanto los guardes.',
    saveChanges: 'Guardar cambios',
    dragTip: 'En la pizarra puedes arrastrar tu lámina para moverla.',
    signOut: 'Cerrar sesión en este dispositivo',
  },
  en: {
    stepOf: 'Step {n} of {total}',
    preview: 'Your slide will look like this',

    // /code
    codeTitle: 'Add your *slide*',
    codeIntro: 'Enter the access code the class organizer shared with you.',
    codeLabel: 'Access code',
    continue: 'Continue',
    checking: 'Checking…',
    askOrganizer: 'Ask the organizer for the current code.',
    haveSlide: 'Already have a slide?',
    loginToEdit: 'Sign in to edit it',
    existingTitle: 'You already have a *slide*',
    existingBody: 'This device remembers your slide. You can edit it or go see it; you can also register someone else below.',
    editMine: 'Edit my slide',

    // /details
    detailsTitle: 'Tell us about *you*',
    detailsIntro: 'Your name and what you learned will be written on your slide, for the whole class to see.',
    fullName: 'Full name',
    fullNamePlaceholder: 'As you want it to appear',
    email: 'Email',
    emailHint: 'Only you and the admin can see it. You’ll use it to sign back in.',
    learning: 'What did you learn in class?',
    learningPlaceholder: 'An idea, a concept, something that surprised you…',
    submit: 'Put my slide on the board',
    saving: 'Saving…',
    goToLogin: 'Sign in',

    // /login
    loginTitle: 'Sign back *in*',
    loginIntro: 'Use the email you registered with and the class’s current access code.',
    loginCodeHint: 'It’s the same code used to register.',
    loginSubmit: 'Sign in',
    signingIn: 'Signing in…',
    noSlide: 'Don’t have a slide yet?',
    registerLink: 'Register',

    // /edit
    editTitle: 'Edit your *slide*',
    editIntro: 'Your changes show up on the board as soon as you save them.',
    saveChanges: 'Save changes',
    dragTip: 'On the board you can drag your slide to move it.',
    signOut: 'Sign out on this device',
  },
} as { es: Record<string, string>; en: Record<string, string> }
