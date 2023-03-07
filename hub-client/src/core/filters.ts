export default {

    matrixDisplayName(name:string) {
        return name.replace(/^@(.*):.*/g, "$1");
    },

    localeDateFromTimestamp(timestamp:number) {
        const date = new Date(timestamp);
        const now = new Date();

        // Today?
        if (
            now.getFullYear()==date.getFullYear() &&
            now.getMonth()==date.getMonth() &&
            now.getDate()==date.getDate()
        ) {
            return date.toLocaleTimeString();
        }

        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    },

};
