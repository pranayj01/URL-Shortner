



export function validateUrl(req,res,next){

   let url = req.body.originalUrl;
   if(
   !url.startsWith("http://") &&
   !url.startsWith("https://")
){
   url = "https://" + url;
}

try{

   new URL(url);

   req.body.originalUrl = url;

   next();

}catch(error){

   return res.status(400).json({
      message:"Invalid URL"
   });

}
}