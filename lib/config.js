export const Config={

    timezone:env=>env.TIMEZONE,
    
    duration:env=>
    
    Number(env.SESSION_DURATION),
    
    buffer:env=>
    
    Number(env.BUFFER_MINUTES)
    
    };