import nodemailer from 'nodemailer';



const Mailer =  nodemailer.createTransport({
    service: "gmail",
    auth: {
        user:"[EMAIL_ADDRESS]",
        pass:""
    }
});

export default Mailer;