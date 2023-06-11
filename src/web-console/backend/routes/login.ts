import express from "express";
import bot from "ROOT";
import { Md5 } from "md5-typescript";
import { getToken } from "../utils/jwt";

export default express.Router().post( "/", ( req, res ) => {
	const num: number = parseInt( <string>req.body.num );
	const pwd: string = req.body.pwd;
	
	if ( bot.config.base.number === num &&
	   ( pwd === bot.config.base.password || pwd === Md5.init( bot.config.base.password ) )
	) {
		res.status( 200 ).send( {
			code: 200,
			data: getToken( bot.config.webConsole.jwtSecret, bot.config.base.number ) }
		);
	} else {
		res.status( 401 ).send( { code: 401, data: {}, msg: "Number or password is incorrect" } );
	}
} );