const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function encodeToBase62(num){
    if(num === 0) return "0";
    // your logic here
    let result = "";
    while(num>0){
        let r = num%62;
        result = chars[r] + result;
        num = Math.floor(num/62);
    }
    
    return result;
    

}