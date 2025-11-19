export enum variant {
    Primary = 'primary',
    Secundary = 'secundary',
    Tertiary = 'tertiary',
    Error = 'error',
    Disabled = 'disabled',
}

export const buttonBgColors: { [key: string]: string } = {
    'primary' : 'bg-buttons-blue hover:opacity-75',
    'secundary' : 'bg-surface-base hover:opacity-75',
    'tertiary' : 'rounded outline outline-1 outline-offset-[-1px] outline-surface-on-surface-dim hover:opacity-75',
    'error' : 'bg-buttons-red hover:opacity-75',
    'disabled' : 'opacity-75 bg-surface-base-50/50 cursor-default',
}

export const buttonTextColors : { [key: string]: string } = {
    'primary' : 'text-accent-on-blue',
    'secundary' : 'text-surface-on-surface-dim',
    'tertiary' : 'text-surface-on-surface-dim',
    'error' : 'text-accent-on-red',
    'disabled' : 'text-surface-on-surface-dim cursor-default',
}
