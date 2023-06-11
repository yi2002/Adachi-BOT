import { BasicConfig, CommandInfo, Unmatch } from "./main";
import { BotConfig } from "@/modules/config";
import bot from "ROOT";
import { escapeRegExp } from "lodash";

export interface OrderMatchResult {
	type: "order";
	header: string;
}

export type OrderConfig = CommandInfo & {
	type: "order";
	headers: string[];
	regexps: string[] | string[][];
	start?: boolean;
	stop?: boolean;
};

interface RegPair {
	header: string;
	genRegExps: RegExp[];
}

export class Order extends BasicConfig {
	public readonly type = "order";
	public readonly regPairs: RegPair[] = [];
	public readonly regParam: string[][];
	
	constructor( config: OrderConfig, botCfg: BotConfig, pluginName: string ) {
		super( config, pluginName );
		
		const headers: string[] = config.headers.map( el => Order.header( el, botCfg.directive.header ) );
		if ( this.desc[0].length > 0 && botCfg.directive.fuzzyMatch ) {
			headers.push( Order.header( this.desc[0], botCfg.directive.header ) ); //添加中文指令名作为识别
		}
		
		let rawRegs = <string[][]>config.regexps;
		const isDeep: boolean = config.regexps.some( el => el instanceof Array );
		if ( !isDeep ) {
			rawRegs = [ <string[]>config.regexps ];
		}
		this.regParam = rawRegs;
		
		for ( let header of headers ) {
			const pair: RegPair = { header, genRegExps: [] };
			for ( let reg of rawRegs ) {
				const r: string = [ "", ...reg ].join( "\\s*" );
				const h: string = escapeRegExp( header );
				const pattern: string = Order.addStartStopChar(
					h + r,
					config.start !== false,
					config.stop !== false
				);
				pair.genRegExps.push( Order.regexp( pattern, this.ignoreCase ) );
			}
			this.regPairs.push( pair );
		}
	}
	
	public static read( cfg: OrderConfig, loaded ) {
		cfg.headers = loaded.headers;
		cfg.auth = loaded.auth;
		cfg.scope = loaded.scope;
		cfg.enable = loaded.enable;
	}
	
	public write() {
		const cfg = <OrderConfig>this.raw;
		return {
			type: "order",
			auth: this.auth,
			scope: this.scope,
			headers: cfg.headers,
			enable: this.enable
		};
	}
	
	public match( content: string ): OrderMatchResult | Unmatch {
		const config = bot.config.directive;
		try {
			this.regPairs.forEach( pair => pair.genRegExps.forEach( reg => {
				/* 是否存在指令起始符 */
				const hasHeader = config.header ? pair.header.includes( config.header ) : false;
				const rawHeader = pair.header.replace( config.header, "" );
				
				let headerRegStr: string = "";
				
				if ( config.fuzzyMatch && rawHeader.length !== 0 && /[\u4e00-\u9fa5]/.test( rawHeader ) ) {
					headerRegStr = `${ hasHeader ? "(?=^" + config.header + ")" : "" }(?=.*?${ rawHeader })`;
				} else if ( config.matchPrompt && config.header && pair.header ) {
					headerRegStr = "^" + pair.header;
				}
				
				const headerReg: RegExp | null = headerRegStr.length !== 0 ? new RegExp( headerRegStr ) : null;
				
				/* 若直接匹配不成功，则匹配指令头，判断参数是否符合要求 */
				if ( reg.test( content ) ) {
					throw { type: "order", header: pair.header };
				} else if ( headerReg && headerReg.test( content ) ) {
					const header = config.header == "" ? pair.header : `${ config.header }|${ rawHeader }`;
					
					const fogReg = new RegExp( header, "g" );
					/* 重组正则，判断是否参数不符合要求 */
					content = content.replace( fogReg, "" );
					for ( let params of this.regParam ) {
						params = [pair.header, ...params];
						const paramReg = new RegExp( `^${ params.join( "\\s*" ) }$` );
						const matchParam = paramReg.test( pair.header + content );
						if ( matchParam ) {
							throw { type: "order", header: pair.header };
						}
					}
					throw { type: "unmatch", missParam: true, header: pair.header, param: content };
				}
			} ) );
		} catch ( data ) {
			return <OrderMatchResult | Unmatch>data;
		}
		return { type: "unmatch", missParam: false };
	}
	
	public getFollow(): string {
		const pairs = this.regPairs.concat();
		if ( pairs[pairs.length - 1].header === Order.header( this.desc[0], bot.config.directive.header ) ) {
			pairs.pop();
		}
		const headers: string = pairs
			.map( el => el.header )
			.join( "|" );
		const param = this.desc[1];
		return `${ headers } ${ param }`;
	}
	
	public getDesc(): string {
		const follow = this.getFollow();
		return Order.addLineFeedChar(
			this.desc[0], follow,
			bot.config.directive.helpMessageStyle
		);
	}
	
	public getHeaders(): string[] {
		return this.regPairs.map( el => el.header );
	}
}