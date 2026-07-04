import Foundation

/// Base URL for the NestJS API. Comes from Info.plist key `SBApiBaseURL`
/// (set per-config in project.yml — never hardcode secrets; §11).
enum ApiConfig {
    static var baseURL: URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "SBApiBaseURL") as? String
        return URL(string: raw ?? "http://localhost:3000/api")!
    }
}
