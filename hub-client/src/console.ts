const isProduction = process.env.NODE_ENV === 'production';

const ReplaceConsole = () => {

    const logReplacement = (org:Function) => (...args : string[]) => {
        if ( !isProduction ) {
            args.unshift("color:#3EA439;font-weight:bold;");
            args.unshift("%c[PH");
            org(...args);
        }
    }

    console.log = logReplacement(console.log);
    console.debug = logReplacement(console.debug);
}

export { isProduction, ReplaceConsole }
