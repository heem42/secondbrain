import Foundation

enum ApiError: Error, LocalizedError {
    case invalidResponse
    case unauthorized
    case server(status: Int, message: String?)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server returned an invalid response."
        case .unauthorized:
            return "Your session has expired. Please sign in again."
        case let .server(status, message):
            return message ?? "Request failed (HTTP \(status))."
        case let .decoding(error):
            return "Couldn't read the server response: \(error.localizedDescription)"
        case let .transport(error):
            return error.localizedDescription
        }
    }
}
