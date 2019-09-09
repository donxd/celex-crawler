const Sequelize = require('sequelize');
const {DataTypes} = Sequelize;
// const DataTypes = Sequelize.DataTypes;

// const mysql = require('mysql2');

// const connection = mysql.createConnection({
//     host: process.env.HT || '172.17.0.2',
//     user: process.env.USR || 'root',
//     password: process.env.PW || 'pruebas',
//     database: process.env.DB || 'celex'
// });

// connection.query('SELECT COUNT(*) as total FROM courses', (err, results, fields) => {
//     console.log('err : ', err);
//     console.log('results : ', results);
//     console.log('fields : ', fields);
// });

// connection
//     .then()

class Persistence {
    processData (data) {
        // console.log('processData : ', data.length);
        // console.log('processData : ', JSON.stringify(data));
        // console.log('courses : ', data.reduce((acc, v) => acc.add(v.language), new Set()));
        // console.log('grade : ', data.reduce((acc, v) => acc.add(v.level), new Set()));
        // console.log('students : ', data.reduce((acc, v) => new Set(Array.from(acc).concat(v.students)), new Set()));
        // console.log('teachers : ', data.reduce((acc, v) => acc.add(v.teacher), new Set()));
        const sequelize = this.getConnection();
        this.configEntities(sequelize);

        Promise.all([
            this.Course.findAll(),
            this.Grade.findAll(),
            this.Student.findAll(),
            this.Teacher.findAll(),
            this.Group.findAll(),
            this.GroupStudent.findAll(),
        ]).then(results => {
            console.log('done');
            console.log('data course : ', results[0]);
            console.log('data grade : ', results[1]);
            console.log('data student : ', results[2]);
            console.log('data teacher : ', results[3]);
            console.log('data group : ', results[4]);
            console.log('data groupStudent : ', results[5]);
            sequelize.close();
            console.log('connection closed');
        }).catch(err => console.log('error : ', err));
    }

    getConnection () {
        return new Sequelize({
            database: process.env.DB || 'celex',
            username: process.env.USR || 'root',
            host: process.env.HT || '172.17.0.2',
            port: process.env.PT || '3306',
            password: process.env.PW || 'pruebas',
            define: {
                timestamps: false
            },
            // options: {
            //     allowPublicKeyRetrieval: true
            // },
            dialect: process.env.DD || 'mysql'
        });
    }

    configEntities (sequelize) {
        this.Course = this.configEntityCourses(sequelize);
        this.Grade = this.configEntityGrades(sequelize);
        this.Student = this.configEntityStudents(sequelize);
        this.Teacher = this.configEntityTeachers(sequelize);
        this.Group = this.configEntityGroups(sequelize);
        // this.Group.hasOne(this.Course);
        // this.Group.hasOne(this.Grade);
        // this.Group.hasOne(this.Teacher);
        this.Group.belongsTo(this.Course, {foreignKey: 'id_course'});
        this.Group.belongsTo(this.Grade, {foreignKey: 'id_grade'});
        this.Group.belongsTo(this.Teacher, {foreignKey: 'id_teacher'});
        this.GroupStudent = this.configEntityGroupStudent(sequelize);
        this.GroupStudent.removeAttribute('id');
        // this.GroupStudent.belongsToMany(this.Group);
        // this.GroupStudent.belongsToMany(this.Student);
        // this.Student.belongsTo(this.Group, {
        //     through: {
        //         model: this.GroupStudent,
        //         scope: {

        //         }
        //     }
        // });
        // this.Student.belongsTo(this.Group, {as: 'Group', through: 'GroupStudent'});
        this.Student.belongsToMany(this.Group, {as: 'Group', through: 'GroupStudent'});
    }

    configEntityCourses (sequelize) {
        return sequelize.define('course', {
            idCourse : {
                field: 'id_course',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityGrades (sequelize) {
        return sequelize.define('grade', {
            idGrade : {
                field: 'id_grade',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityStudents (sequelize) {
        return sequelize.define('student', {
            idStudent : {
                field: 'id_student',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : { 
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityTeachers (sequelize) {
        return sequelize.define('teacher', {
            idTeacher : {
                field: 'id_teacher',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityGroups (sequelize) {
        return sequelize.define('group', {
            idGroup : {
                field: 'id_group',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            schedule : {
                field: 'schedule',
                type: DataTypes.STRING,
                allowNull: false
            },
            publication : {
                field: 'publication',
                type: DataTypes.DATE,
                allowNull: false
            },
            bimester : {
                field: 'bimester',
                type: DataTypes.STRING,
                allowNull: false
            },
            classroom : {
                field: 'classroom',
                type: DataTypes.STRING,
                allowNull: false
            },
            idCourse : {
                field: 'id_course',
                type: DataTypes.INTEGER,
                allowNull: false
            },
            idGrade : {
                field: 'id_grade',
                type: DataTypes.INTEGER,
                allowNull: false
            },
            idTeacher : {
                field: 'id_teacher',
                type: DataTypes.INTEGER,
                allowNull: false
            }
        });
    }
    configEntityGroupStudent (sequelize) {
        return sequelize.define('groupStudent', {
            idGroup : {
                field: 'id_group',
                type: DataTypes.INTEGER,
                allowNull: false
            },
            idStudent : { 
                field: 'id_student',
                type: DataTypes.INTEGER,
                allowNull: false
            }
        }, {
            tableName: 'group_student'
        });
    }
}

module.exports = Persistence;