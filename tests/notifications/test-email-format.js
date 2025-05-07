import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

// Load environment variables
const envPath = path.join(projectRoot, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
        acc[key] = value;
    }
    return acc;
}, {});

// Create email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: envVars.VITE_EMAIL_USERNAME,
        pass: envVars.VITE_EMAIL_PASSWORD
    }
});

async function sendTestEmailWithNewFormat() {
    // Sample data for testing
    const testChanges = {
        critical: [
            {
                type: 'replacement',
                removedJobId: '112041',
                removedStore: '#5133',
                removedDispensers: 8,
                removedLocation: 'Riverview, FL',
                removedStoreName: '7-Eleven',
                addedJobId: '112042',
                addedStore: '#5286',
                addedDispensers: 6,
                addedLocation: 'Riverview, FL',
                addedStoreName: '7-Eleven',
                date: '04/14/2025'
            },
            {
                type: 'removed',
                jobId: '112043',
                store: '#5134',
                storeName: '7-Eleven',
                dispensers: 4,
                location: 'Tampa, FL',
                date: '04/15/2025'
            }
        ],
        high: [
            {
                type: 'date_changed',
                jobId: '112044',
                store: '#2707004',
                storeName: 'Circle K',
                dispensers: 6,
                location: 'Orlando, FL',
                oldDate: '04/14/2025',
                newDate: '04/16/2025'
            },
            {
                type: 'added',
                jobId: '128659',
                store: '#38578',
                storeName: '7-Eleven',
                dispensers: 8,
                location: 'Lakeland, FL',
                date: '04/30/2025'
            }
        ]
    };

    // Create HTML content for the email with enhanced styling
    let htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="color: #2c3e50; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                    Schedule Changes Alert
                </h2>
                
                <p style="color: #34495e; font-size: 16px; margin-bottom: 25px;">
                    The following changes have been detected in your work schedule:
                </p>

                <div style="margin-bottom: 30px;">
                    <ul style="list-style-type: none; padding: 0;">
                        ${[...testChanges.critical, ...testChanges.high].map(change => {
                            switch (change.type) {
                                case 'replacement':
                                    return `
                                        <li style="background-color: #fff5f5; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                            <!-- Store Info Card -->
                                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db; margin-bottom: 20px;">
                                                <div style="display: flex; align-items: center;">
                                                    <div style="flex-shrink: 0; margin-right: 15px;">
                                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h3 style="margin: 0; color: #2c3e50; font-size: 18px;">${change.removedStoreName}</h3>
                                                        <p style="margin: 5px 0 0; color: #7f8c8d; font-size: 14px;">Store ${change.removedStore}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div style="color: #e74c3c; font-weight: bold; font-size: 16px; margin-bottom: 15px;">Schedule Change</div>
                                            <div style="margin-bottom: 12px; color: #2c3e50;">
                                                <div style="margin-bottom: 12px;">
                                                    <div style="color: #7f8c8d; margin-bottom: 4px;">Removed:</div>
                                                    <div style="font-weight: 500; font-size: 15px;">Visit #${change.removedJobId} - ${change.removedDispensers} Dispensers (${change.removedLocation})</div>
                                                </div>
                                                <div style="margin-bottom: 12px;">
                                                    <div style="color: #7f8c8d; margin-bottom: 4px;">Added:</div>
                                                    <div style="font-weight: 500; font-size: 15px;">Visit #${change.addedJobId} - ${change.addedDispensers} Dispensers (${change.addedLocation})</div>
                                                </div>
                                                <div style="color: #7f8c8d;">
                                                    <span style="display: inline-block; width: 80px;">Date:</span> 
                                                    <span style="color: #2c3e50;">${change.date}</span>
                                                </div>
                                            </div>
                                        </li>
                                    `;
                                case 'removed':
                                    return `
                                        <li style="background-color: #fff5f5; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                            <!-- Store Info Card -->
                                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db; margin-bottom: 20px;">
                                                <div style="display: flex; align-items: center;">
                                                    <div style="flex-shrink: 0; margin-right: 15px;">
                                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h3 style="margin: 0; color: #2c3e50; font-size: 18px;">${change.storeName}</h3>
                                                        <p style="margin: 5px 0 0; color: #7f8c8d; font-size: 14px;">Store ${change.store}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div style="color: #e74c3c; font-weight: bold; font-size: 16px; margin-bottom: 15px;">Visit Removed</div>
                                            <div style="margin-bottom: 12px; color: #2c3e50;">
                                                <div style="font-weight: 500; font-size: 15px; margin-bottom: 8px;">
                                                    Visit #${change.jobId} - ${change.dispensers} Dispensers (${change.location})
                                                </div>
                                                <div style="color: #7f8c8d;">
                                                    <span style="display: inline-block; width: 80px;">Date:</span> 
                                                    <span style="color: #2c3e50;">${change.date}</span>
                                                </div>
                                            </div>
                                        </li>
                                    `;
                                case 'added':
                                    return `
                                        <li style="background-color: #f0fff4; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                            <!-- Store Info Card -->
                                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db; margin-bottom: 20px;">
                                                <div style="display: flex; align-items: center;">
                                                    <div style="flex-shrink: 0; margin-right: 15px;">
                                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h3 style="margin: 0; color: #2c3e50; font-size: 18px;">${change.storeName}</h3>
                                                        <p style="margin: 5px 0 0; color: #7f8c8d; font-size: 14px;">Store ${change.store}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div style="color: #2ecc71; font-weight: bold; font-size: 16px; margin-bottom: 15px;">New Visit Added</div>
                                            <div style="margin-bottom: 12px; color: #2c3e50;">
                                                <div style="font-weight: 500; font-size: 15px; margin-bottom: 8px;">
                                                    Visit #${change.jobId} - ${change.dispensers} Dispensers (${change.location})
                                                </div>
                                                <div style="color: #7f8c8d;">
                                                    <span style="display: inline-block; width: 80px;">Date:</span> 
                                                    <span style="color: #2c3e50;">${change.date}</span>
                                                </div>
                                            </div>
                                        </li>
                                    `;
                                case 'date_changed':
                                    return `
                                        <li style="background-color: #fff9e6; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                            <!-- Store Info Card -->
                                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db; margin-bottom: 20px;">
                                                <div style="display: flex; align-items: center;">
                                                    <div style="flex-shrink: 0; margin-right: 15px;">
                                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h3 style="margin: 0; color: #2c3e50; font-size: 18px;">${change.storeName}</h3>
                                                        <p style="margin: 5px 0 0; color: #7f8c8d; font-size: 14px;">Store ${change.store}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div style="color: #f39c12; font-weight: bold; font-size: 16px; margin-bottom: 15px;">Date Changed</div>
                                            <div style="margin-bottom: 12px; color: #2c3e50;">
                                                <div style="font-weight: 500; font-size: 15px; margin-bottom: 12px;">
                                                    Visit #${change.jobId} - ${change.dispensers} Dispensers (${change.location})
                                                </div>
                                                <div style="margin-bottom: 8px;">
                                                    <div style="color: #7f8c8d; margin-bottom: 4px;">From:</div>
                                                    <div style="color: #2c3e50;">${change.oldDate}</div>
                                                </div>
                                                <div>
                                                    <div style="color: #7f8c8d; margin-bottom: 4px;">To:</div>
                                                    <div style="color: #2c3e50;">${change.newDate}</div>
                                                </div>
                                            </div>
                                        </li>
                                    `;
                                default:
                                    return '';
                            }
                        }).join('')}
                    </ul>
                </div>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; text-align: center;">
                    <p style="color: #7f8c8d; font-size: 12px;">
                        This is an automated notification from Fossa Monitor. Please do not reply to this email.
                    </p>
                </div>
            </div>
        </div>
    `;

    // Email options with improved sender name
    const mailOptions = {
        from: {
            name: 'Fossa Monitor',
            address: envVars.VITE_EMAIL_USERNAME
        },
        to: envVars.VITE_RECIPIENT_EMAIL,
        subject: 'Fossa Monitor: Test Email with New Store Format',
        html: htmlContent
    };

    console.log('Sending test email...');
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response);
        return { success: true, info };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
}

sendTestEmailWithNewFormat()
    .then(result => {
        console.log('Test complete:', result.success ? 'Success' : 'Failed');
        if (result.success) {
            console.log('Email sent successfully to', envVars.VITE_RECIPIENT_EMAIL);
        }
    })
    .catch(error => {
        console.error('Test failed:', error);
    }); 