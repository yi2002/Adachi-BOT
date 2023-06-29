import { BasicConfig, CommandInfo, FollowInfo, Unmatch } from "./main";
import { BotConfig } from "@/modules/config";
import bot from "ROOT";
import { escapeRegExp } from "lodash";

export interface OrderMatchResult {
	type: "order";
	header: string;
	match: string[];
}

export type OrderConfig = CommandInfo & {
	type: "order";
	headers: string[];
	regexps: string[] | string[][];
	start?: boolean;
	stop?: boolean;
	priority?: number;
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
		
		this.regParam = this.checkRegexps( config.regexps ) ? config.regexps : [ config.regexps ];
		this.regPairs = headers.map( header => ( {
			header,
			genRegExps: this.regParam.map( reg => {
				// 非捕获正则字符串中的分组，并捕获整段参数
				const regList = reg.map( r => {
					const fr = r.replace( /\((.+?)\)/g, "(?:$1)" );
					return `(${ fr })`;
				} );
				const r: string = [ "", ...regList ].join( "\\s*" );
				const h: string = escapeRegExp( header );
				const pattern: string = Order.addStartStopChar(
					h + r,
					config.start !== false,
					config.stop !== false
				);
				return Order.regexp( pattern, this.ignoreCase );
			} )
		} ) );
	}
	
	private checkRegexps( regexps: OrderConfig["regexps"] ): regexps is string[][] {
		return regexps.some( el => el instanceof Array );
	}
	
	public static read( cfg: OrderConfig, loaded ) {
		cfg.headers = loaded.headers;
		cfg.auth = loaded.auth;
		cfg.scope = loaded.scope;
		cfg.enable = loaded.enable;
		cfg.priority = Number.parseInt( loaded.priority ) || 0;
	}
	
	public write() {
		const cfg = <OrderConfig>this.raw;
		return {
			type: "order",
			auth: this.auth,
			scope: this.scope,
			headers: cfg.headers,
			enable: this.enable,
			priority: this.priority
		};
	}
	
	public getExtReg( pair: RegPair ) {
		const config = bot.config.directive;
		/* 是否存在指令起始符 */
		const hasHeader = config.header ? pair.header.includes( config.header ) : false;
		const rawHeader = pair.header.replace( config.header, "" );
		
		let headerRegStr: string = "";
		if ( config.fuzzyMatch && rawHeader.length !== 0 && /[\u4e00-\u9fa5]/.test( rawHeader ) ) {
			headerRegStr = `${ hasHeader ? "(?=^" + config.header + ")" : "" }(?=.*?${ rawHeader })`;
		} else if ( config.matchPrompt && config.header && pair.header ) {
			headerRegStr = "^" + pair.header;
		}
		
		return headerRegStr || null;
	}
	
	public match( content: string ): OrderMatchResult | Unmatch {
		const config = bot.config.directive;
		for ( const pair of this.regPairs ) {
			const headerRegStr = this.getExtReg( pair );
			const headerReg = headerRegStr ? new RegExp( headerRegStr ) : null;
			
			const rawHeader = pair.header.replace( config.header, "" );
			
			// 是否匹配成功指令头（用于判断是否触发指令的参数错误）
			let isMatchHeader = false;
			for ( const reg of pair.genRegExps ) {
				const match = reg.exec( content );
				if ( match ) {
					// 匹配成功
					return { type: "order", header: pair.header, match: [ ...match ].slice( 1 ) };
				} else if ( headerReg && headerReg.test( content ) ) {
					// 直接匹配不成功但模糊匹配指令头成功时，仅开启了 fuzzyMatch 或 matchPrompt 后才会执行此部分
					const header = config.header == "" ? pair.header : `${ config.header }|${ rawHeader }`;
					const fogReg = new RegExp( header, "g" );
					
					const formatContent = pair.header + content.replace( fogReg, "" ).trim();
					const match = reg.exec( formatContent );
					if ( match ) {
						// 模糊匹配成功
						return { type: "order", header: pair.header, match: [ ...match ].slice( 1 ) };
					}
					isMatchHeader = true;
				}
			}
			// 此时指令头匹配成功，但参数不正确
			if ( isMatchHeader ) {
				return { type: "unmatch", missParam: true, header: pair.header, param: content };
			}
		}
		// 匹配失败
		return { type: "unmatch", missParam: false };
	}
	
	public getFollow(): FollowInfo {
		const headers = this.regPairs.map( el => el.header );
		const param = this.desc[1];
		return { headers, param };
	}
	
	public getDesc( headerNum?: number ): string {
		const { headers, param } = this.getFollow();
		const headerList = headerNum ? headers.slice( 0, headerNum ) : headers;
		const follow = `${ headerList.join( "|" ) } ${ param }`;
		return Order.addLineFeedChar(
			this.desc[0], follow,
			bot.config.directive.helpMessageStyle
		);
	}
	
	public getHeaders(): string[] {
		return this.regPairs.map( el => el.header );
	}
}