const cases = [
    '<function=get_current_time={"timezone": "UTC"}></function>',
    '<function=get_current_time({"timezone": "UTC"})></function>',
    '<function=get_current_time{"timezone": "Europe/Madrid"}></function>'
];

for (const c of cases) {
    const match = c.match(/<function=([\w_]+)[=({]*\s*(.*?)\s*[)}]*><\/function>/);
    if (match) {
        let args = match[2];
        if (args.endsWith('}') && !args.startsWith('{')) args = '{' + args;
        if (args.startsWith('{') && !args.endsWith('}')) args = args + '}';
        try {
            JSON.parse(args);
            console.log("OK", match[1], args);
        } catch (e) {
            console.log("ERR", match[1], args, e.message);
        }
    } else {
        console.log('no match for ' + c);
    }
}
