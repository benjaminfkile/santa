const reggie = {
    formatPhone: (input: string) => {//returns string
        let cleaned = ('' + input).replace(/\D/g, '');
        let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            let intlCode = (match[1] ? '+1 ' : '');
            return [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('');
        }
        return null;
    },
    validateMail: (mail: string) => {//returns boolean
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        return re.test(String(mail).toLowerCase())
    },
    formatThousands: (number: number) => {//returns string
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    }
}
export default reggie